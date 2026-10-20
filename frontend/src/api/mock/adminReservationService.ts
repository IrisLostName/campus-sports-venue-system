// docs/12 第 5.7 节、docs/10 第 6 节：管理员预约列表、取消、资源改派、人员改派。
// 统一阶段顺序（规划裁决 §7-6）：认证 → 格式 VALIDATION_ERROR → REASON_REQUIRED → 角色 FORBIDDEN → 预约不存在 NOT_FOUND
//   → 越权 FORBIDDEN_SCOPE → INVALID_STATE → ALREADY_CHECKED_IN（仅两类改派）→ 目标检查。
import type { ApiClient } from '../client'
import type { Page, Reservation } from '../types'
import type {
  AdminCancelRequest, AdminReservationsQuery, ReassignResourceRequest, ReassignUserRequest,
} from '../requests'
import type { AdminReservation } from '../typesSection5'
import { RESERVATION_STATUSES } from './enums'
import { fail } from './fail'
import { authenticate, manageableVenueIds, requireRole, requireScope } from './guards'
import { reasonProblem } from './impact'
import { appendLog, snapshot } from './logService'
import { getOrFail } from './lookup'
import { pageOf } from './paging'
import {
  endSeconds, nowSeconds, toAdminReservation, toReservation, venueIdOfReservation,
} from './reservationView'
import { run } from './run'
import { findActiveReservation, isClosedByRule, isDerivedSlot, isUnavailable } from './slotDerivation'
import type { MockContext, ReservationRecord, UserRecord } from './state'
import { endTimeOf, slotSeconds } from './timeMath'
import {
  collect, dateProblem, intProblem, isBlank, keywordNeedle, keywordProblem, oneOfProblem, optional, pagingChecks, timeProblem,
} from './validate'

function requireReason(reason: string | null | undefined): string {
  if (reason === undefined || reason === null || isBlank(reason)) {
    return fail('REASON_REQUIRED')
  }
  return reason
}

// 预约存在 → 授权范围 → CONFIRMED 且 end_time 在未来。
function manageableReservation(ctx: MockContext, user: UserRecord, id: number): ReservationRecord {
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const record = getOrFail(ctx.state.reservations, id)
  requireScope(ctx, user, venueIdOfReservation(ctx, record))
  if (record.status !== 'CONFIRMED' || endSeconds(record) <= nowSeconds(ctx)) {
    fail('INVALID_STATE', { status: record.status })
  }
  return record
}

function requireNotCheckedIn(record: ReservationRecord): void {
  if (record.checkInAt !== null) {
    fail('ALREADY_CHECKED_IN')
  }
}

function matchesKeyword(ctx: MockContext, record: ReservationRecord, needle: string | null): boolean {
  if (needle === null) {
    return true
  }
  const view = toAdminReservation(ctx, record)
  return [view.userUsername, view.userDisplayName, view.resourceName].some((text) => text.toLowerCase().includes(needle))
}

function visibleReservations(ctx: MockContext, user: UserRecord, query: AdminReservationsQuery): ReservationRecord[] {
  if (query.venueId !== undefined) {
    requireScope(ctx, user, query.venueId)
  }
  const venueIds = query.venueId === undefined ? manageableVenueIds(ctx, user) : [query.venueId]
  const needle = keywordNeedle(query.keyword)
  return ctx.state.reservations.filter((record) =>
    venueIds.includes(venueIdOfReservation(ctx, record))
    && (query.dateFrom === undefined || record.serviceDate >= query.dateFrom)
    && (query.dateTo === undefined || record.serviceDate <= query.dateTo)
    && (query.status === undefined || record.status === query.status)
    && matchesKeyword(ctx, record, needle))
}

function listReservations(ctx: MockContext, query: AdminReservationsQuery): Page<AdminReservation> {
  const user = authenticate(ctx)
  collect([
    ['venueId', optional(query.venueId, (value) => intProblem(value))],
    ['dateFrom', optional(query.dateFrom, dateProblem)],
    ['dateTo', optional(query.dateTo, dateProblem)],
    ['status', optional(query.status, (value) => oneOfProblem(value, RESERVATION_STATUSES))],
    ['keyword', optional(query.keyword, keywordProblem)],
    ...pagingChecks(query.page, query.pageSize),
  ])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const records = visibleReservations(ctx, user, query)
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || b.startTime.localeCompare(a.startTime) || b.id - a.id)
  return pageOf(records.map((record) => toAdminReservation(ctx, record)), query.page, query.pageSize)
}

// 取消：管理员在授权范围内；预约为 CONFIRMED 且 end_time 在未来；填写原因 → ADMIN_CANCELLED，admin_note = 原因，写日志。
function cancelReservation(ctx: MockContext, id: number, request: AdminCancelRequest): Reservation {
  const user = authenticate(ctx)
  collect([['reason', optional(request.reason, reasonProblem)]])
  const reason = requireReason(request.reason)
  const record = manageableReservation(ctx, user, id)
  const before = toReservation(ctx, record)
  record.status = 'ADMIN_CANCELLED'
  record.cancelledAt = ctx.clock.now()
  record.cancelledBy = user.id
  record.adminNote = reason
  const after = toReservation(ctx, record)
  appendLog(ctx, user, {
    venueId: after.venueId, action: 'RESERVATION_CANCEL', targetId: record.id, reason,
    before: snapshot(before, [record.id]), after: snapshot(after, [record.id]),
  })
  return after
}

// 目标检查：场地不存在或不属于原预约所在场馆 → SLOT_NOT_AVAILABLE；
// 再依次 SLOT_NOT_AVAILABLE（派生时段、场馆与场地 OPEN、不在关闭规则内；不受 advanceDays 与 userBookingEnabled 限制）
// → SLOT_IN_PAST → SLOT_TAKEN（占用检查排除预约自身）。
function checkResourceTarget(ctx: MockContext, record: ReservationRecord, request: ReassignResourceRequest): void {
  const { state } = ctx
  const target = state.resources.find((resource) => resource.id === request.resourceId)
  const venue = state.venues.find((candidate) => candidate.id === venueIdOfReservation(ctx, record))
  if (target === undefined || venue === undefined || target.venueId !== venue.id) {
    fail('SLOT_NOT_AVAILABLE')
    return
  }
  const closed = isClosedByRule(state, venue.id, target.id, request.serviceDate)
  if (!isDerivedSlot(state, venue.id, request.serviceDate, request.startTime) || isUnavailable(venue, target, closed)) {
    fail('SLOT_NOT_AVAILABLE')
  }
  if (slotSeconds(request.serviceDate, request.startTime) <= nowSeconds(ctx)) {
    fail('SLOT_IN_PAST')
  }
  if (findActiveReservation(state, target.id, request.serviceDate, request.startTime, record.id) !== undefined) {
    fail('SLOT_TAKEN')
  }
}

function reassignResource(ctx: MockContext, id: number, request: ReassignResourceRequest): Reservation {
  const user = authenticate(ctx)
  collect([
    ['resourceId', intProblem(request.resourceId)],
    ['serviceDate', dateProblem(request.serviceDate)],
    ['startTime', timeProblem(request.startTime)],
    ['reason', optional(request.reason, reasonProblem)],
  ])
  const reason = requireReason(request.reason)
  const record = manageableReservation(ctx, user, id)
  requireNotCheckedIn(record)
  checkResourceTarget(ctx, record, request)
  const before = toReservation(ctx, record)
  record.resourceId = request.resourceId
  record.serviceDate = request.serviceDate
  record.startTime = request.startTime
  record.endTime = endTimeOf(request.startTime)
  record.adminNote = reason
  const after = toReservation(ctx, record)
  appendLog(ctx, user, {
    venueId: after.venueId, action: 'RESERVATION_REASSIGN_RESOURCE', targetId: record.id, reason,
    before: snapshot(before, [record.id]), after: snapshot(after, [record.id]),
  })
  return after
}

// 人员改派：目标用户不存在、角色不是 USER 或账号非 ACTIVE 一律 USER_NOT_ELIGIBLE；不校验目标用户的预约数上限。
function reassignUser(ctx: MockContext, id: number, request: ReassignUserRequest): Reservation {
  const user = authenticate(ctx)
  collect([
    ['userId', intProblem(request.userId)],
    ['reason', optional(request.reason, reasonProblem)],
  ])
  const reason = requireReason(request.reason)
  const record = manageableReservation(ctx, user, id)
  requireNotCheckedIn(record)
  const target = ctx.state.users.find((candidate) => candidate.id === request.userId)
  if (target === undefined || target.role !== 'USER' || target.status !== 'ACTIVE') {
    fail('USER_NOT_ELIGIBLE')
  }
  const before = toReservation(ctx, record)
  record.userId = target.id
  record.adminNote = reason
  const after = toReservation(ctx, record)
  appendLog(ctx, user, {
    venueId: after.venueId, action: 'RESERVATION_REASSIGN_USER', targetId: record.id, reason,
    before: snapshot(before, [record.id]), after: snapshot(after, [record.id]),
  })
  return after
}

export type AdminReservationApi = Pick<ApiClient,
  'adminListReservations' | 'adminCancelReservation' | 'adminReassignResource' | 'adminReassignUser'>

export function adminReservationApi(ctx: MockContext): AdminReservationApi {
  return {
    adminListReservations: (query = {}) => run(ctx, () => listReservations(ctx, query)),
    adminCancelReservation: (id, request) => run(ctx, () => cancelReservation(ctx, id, request)),
    adminReassignResource: (id, request) => run(ctx, () => reassignResource(ctx, id, request)),
    adminReassignUser: (id, request) => run(ctx, () => reassignUser(ctx, id, request)),
  }
}
