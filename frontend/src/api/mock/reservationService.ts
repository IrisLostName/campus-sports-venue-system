// 用户端预约：创建、我的预约、详情、取消、签到、签退（docs/12 第 5.3 节；docs/10 第 1、3、4 节）。
import type { ApiClient } from '../client'
import type { Page, Reservation } from '../types'
import type { CancelReservationRequest, CreateReservationRequest, MyReservationsQuery } from '../requests'
import { RESERVATION_SCOPES } from './enums'
import { fail } from './fail'
import { authenticate, requireRole, requireScope } from './guards'
import { getOrFail } from './lookup'
import { pageOf } from './paging'
import { checkCreatable, insertReservation } from './reservationRules'
import {
  checkInWindow, checkOutDeadlineSeconds, endSeconds, nowSeconds, startSeconds, toReservation, venueIdOfReservation,
} from './reservationView'
import { run } from './run'
import type { MockContext, ReservationRecord, UserRecord } from './state'
import { collect, dateProblem, intProblem, oneOfProblem, optional, pagingChecks, textProblem, timeProblem } from './validate'
import { secondsOf } from './timeMath'

function createReservation(ctx: MockContext, request: CreateReservationRequest): Reservation {
  const user = authenticate(ctx)
  collect([
    ['resourceId', intProblem(request.resourceId)],
    ['serviceDate', dateProblem(request.serviceDate)],
    ['startTime', timeProblem(request.startTime)],
    ['purpose', optional(request.purpose, (value) => textProblem(value, 200))],
  ])
  requireRole(user, 'USER')
  checkCreatable(ctx, user, request)
  const record = insertReservation(ctx, {
    userId: user.id, resourceId: request.resourceId, serviceDate: request.serviceDate,
    startTime: request.startTime, purpose: request.purpose ?? null,
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
  collect([['reason', optional(request.reason, (value) => textProblem(value, 200))]])
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
  record.cancelReason = request.reason ?? null
  return toReservation(ctx, record)
}

// 10 第 4 节：本人 → CONFIRMED → 当前时间 ∈ [start − 15, start + 15]（闭区间）→ 尚无签到记录。
function checkIn(ctx: MockContext, id: number): Reservation {
  const user = authenticate(ctx)
  const record = ownReservation(ctx, user, id)
  if (record.status !== 'CONFIRMED') {
    fail('INVALID_STATE', { status: record.status })
  }
  const window = checkInWindow(ctx, record)
  const now = nowSeconds(ctx)
  if (now < secondsOf(window.opensAt) || now > secondsOf(window.closesAt)) {
    fail('CHECKIN_WINDOW_CLOSED', window)
  }
  if (record.checkInAt !== null) {
    fail('ALREADY_CHECKED_IN')
  }
  record.checkInAt = ctx.clock.now()
  return toReservation(ctx, record)
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
  'createReservation' | 'listMyReservations' | 'getReservation' | 'cancelReservation' | 'checkIn' | 'checkOut'>

export function reservationApi(ctx: MockContext): ReservationApi {
  return {
    createReservation: (request) => run(ctx, () => createReservation(ctx, request)),
    listMyReservations: (query = {}) => run(ctx, () => listMyReservations(ctx, query)),
    getReservation: (id) => run(ctx, () => getReservation(ctx, id)),
    cancelReservation: (id, request = {}) => run(ctx, () => cancelReservation(ctx, id, request)),
    checkIn: (id) => run(ctx, () => checkIn(ctx, id)),
    checkOut: (id) => run(ctx, () => checkOut(ctx, id)),
  }
}
