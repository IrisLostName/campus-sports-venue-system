// 用户端预约：创建、我的预约、详情、取消、签到码（v1.1）、签退（docs/12 第 5.3 节；docs/10 第 1、3、4 节）。
import type { ApiClient } from '../client'
import type { CheckInCode, Page, Reservation } from '../types'
import type { CancelReservationRequest, CreateReservationRequest, MyReservationsQuery } from '../requests'
import { formatCheckInCode } from './checkInCodes'
import { RESERVATION_SCOPES } from './enums'
import { fail } from './fail'
import { authenticate, requireRole, requireScope } from './guards'
import { getOrFail } from './lookup'
import { pageOf } from './paging'
import { checkCreatable, insertReservation } from './reservationRules'
import {
  checkOutDeadlineSeconds, endSeconds, nowSeconds, startSeconds, toReservation, venueIdOfReservation,
} from './reservationView'
import { run } from './run'
import type { MockContext, ReservationRecord, UserRecord } from './state'
import { blankToNull, collect, dateProblem, intProblem, oneOfProblem, optional, optionalText, pagingChecks, timeProblem } from './validate'

function createReservation(ctx: MockContext, request: CreateReservationRequest): Reservation {
  const user = authenticate(ctx)
  collect([
    ['resourceId', intProblem(request.resourceId)],
    ['serviceDate', dateProblem(request.serviceDate)],
    ['startTime', timeProblem(request.startTime)],
    ['purpose', optionalText(request.purpose, 200)],
  ])
  requireRole(user, 'USER')
  checkCreatable(ctx, user, request)
  const record = insertReservation(ctx, {
    userId: user.id, resourceId: request.resourceId, serviceDate: request.serviceDate,
    startTime: request.startTime, purpose: blankToNull(request.purpose),
  })
  return toReservation(ctx, record)
}

function isCurrent(ctx: MockContext, record: ReservationRecord): boolean {
  return record.status === 'CONFIRMED' && endSeconds(record) > nowSeconds(ctx)
}

function newestFirst(a: ReservationRecord, b: ReservationRecord): number {
  return b.serviceDate.localeCompare(a.serviceDate) || b.startTime.localeCompare(a.startTime) || b.id - a.id
}

// CURRENT：CONFIRMED 且未结束，按开始时间升序；HISTORY：其余，按开始时间倒序；ALL（默认）：倒序，同刻按 id 倒序。
function listMyReservations(ctx: MockContext, query: MyReservationsQuery): Page<Reservation> {
  const user = authenticate(ctx)
  collect([
    ['scope', optional(query.scope, (value) => oneOfProblem(value, RESERVATION_SCOPES))],
    ...pagingChecks(query.page, query.pageSize),
  ])
  requireRole(user, 'USER')
  const mine = ctx.state.reservations.filter((record) => record.userId === user.id)
  const scope = query.scope ?? 'ALL'
  const picked = scope === 'ALL' ? mine : mine.filter((record) => isCurrent(ctx, record) === (scope === 'CURRENT'))
  const sorted = picked.sort(scope === 'CURRENT' ? (a, b) => -newestFirst(a, b) : newestFirst)
  return pageOf(sorted.map((record) => toReservation(ctx, record)), query.page, query.pageSize)
}

// USER 只能看自己的（NOT_OWNER）；VA 限授权场馆（FORBIDDEN_SCOPE）；SA 全局。
function getReservation(ctx: MockContext, id: number): Reservation {
  const user = authenticate(ctx)
  const record = getOrFail(ctx.state.reservations, id)
  if (user.role === 'USER' && record.userId !== user.id) {
    fail('NOT_OWNER')
  }
  if (user.role === 'VENUE_ADMIN') {
    requireScope(ctx, user, venueIdOfReservation(ctx, record))
  }
  return toReservation(ctx, record)
}

// 用户端写操作的共同前置：认证 → 角色 USER → 预约存在 → 本人。
function ownReservation(ctx: MockContext, user: UserRecord, id: number): ReservationRecord {
  requireRole(user, 'USER')
  const record = getOrFail(ctx.state.reservations, id)
  if (record.userId !== user.id) {
    fail('NOT_OWNER')
  }
  return record
}

// 10 第 3 节：本人 → CONFIRMED → 无签到记录 → 距开始 ≥ cancelDeadlineMinutes。
function cancelReservation(ctx: MockContext, id: number, request: CancelReservationRequest): Reservation {
  const user = authenticate(ctx)
  collect([['reason', optionalText(request.reason, 200)]])
  const record = ownReservation(ctx, user, id)
  if (record.status !== 'CONFIRMED') {
    fail('INVALID_STATE', { status: record.status })
  }
  if (record.checkInAt !== null) {
    fail('ALREADY_CHECKED_IN')
  }
  if (startSeconds(record) - nowSeconds(ctx) < ctx.rules.cancelDeadlineMinutes * 60) {
    fail('CANCEL_DEADLINE_PASSED', { cancelDeadlineMinutes: ctx.rules.cancelDeadlineMinutes })
  }
  record.status = 'CANCELLED'
  record.cancelledAt = ctx.clock.now()
  record.cancelledBy = user.id
  record.cancelReason = blankToNull(request.reason)
  return toReservation(ctx, record)
}

// v1.1 签发签到码（docs/12 第 5.3 节，与后端 CheckInCodeService 同序）：认证 → 角色 USER → NOT_FOUND → NOT_OWNER →
// 有效状态 CONFIRMED（否则 INVALID_STATE；已结束的预约有效状态为 NO_SHOW / COMPLETED）→ 尚未签到（否则 ALREADY_CHECKED_IN）。
// 不检查签到窗口：窗口开始前即可出示，是否在窗口内由扫码时裁决。
function getCheckInCode(ctx: MockContext, id: number): CheckInCode {
  const user = authenticate(ctx)
  const record = ownReservation(ctx, user, id)
  if (record.status !== 'CONFIRMED') {
    fail('INVALID_STATE', { status: record.status })
  }
  if (record.checkInAt !== null) {
    fail('ALREADY_CHECKED_IN')
  }
  return { code: formatCheckInCode(user.checkInUuid, record.id) }
}

// 10 第 4 节：本人 → CONFIRMED 或 COMPLETED → 已签到 → 未签退 → 当前时间 < end + checkOutGraceMinutes。
function checkOut(ctx: MockContext, id: number): Reservation {
  const user = authenticate(ctx)
  const record = ownReservation(ctx, user, id)
  if (record.status !== 'CONFIRMED' && record.status !== 'COMPLETED') {
    fail('INVALID_STATE', { status: record.status })
  }
  if (record.checkInAt === null) {
    fail('NOT_CHECKED_IN')
  }
  if (record.checkOutAt !== null) {
    fail('ALREADY_CHECKED_OUT')
  }
  if (nowSeconds(ctx) >= checkOutDeadlineSeconds(ctx, record)) {
    fail('INVALID_STATE', { status: record.status })
  }
  record.checkOutAt = ctx.clock.now()
  return toReservation(ctx, record)
}

export type ReservationApi = Pick<ApiClient,
  'createReservation' | 'listMyReservations' | 'getReservation' | 'cancelReservation' | 'getCheckInCode' | 'checkOut'>

export function reservationApi(ctx: MockContext): ReservationApi {
  return {
    createReservation: (request) => run(ctx, () => createReservation(ctx, request)),
    listMyReservations: (query = {}) => run(ctx, () => listMyReservations(ctx, query)),
    getReservation: (id) => run(ctx, () => getReservation(ctx, id)),
    cancelReservation: (id, request = {}) => run(ctx, () => cancelReservation(ctx, id, request)),
    getCheckInCode: (id) => run(ctx, () => getCheckInCode(ctx, id)),
    checkOut: (id) => run(ctx, () => checkOut(ctx, id)),
  }
}
