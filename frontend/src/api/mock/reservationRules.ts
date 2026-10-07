// 创建预约的服务端检查顺序（docs/10 第 1 节，九步；任一步失败即返回，后续不执行）。
// 第 1 步（认证、格式、角色）在 reservationService.createReservation 中完成；本文件是第 2–9 步，一步一个函数。
import type { CreateReservationRequest } from '../requests'
import { fail } from './fail'
import { endSeconds, nowSeconds } from './reservationView'
import { findActiveReservation, isDerivedSlot, isClosedByRule } from './slotDerivation'
import { nextId, type MockContext, type ReservationRecord, type ResourceRecord, type UserRecord, type VenueRecord } from './state'
import { dateOf, endTimeOf, isWithinAdvance, slotSeconds } from './timeMath'

interface Target { resource: ResourceRecord; venue: VenueRecord }

// 第 2 步：场地存在，所属场馆 OPEN 且 userBookingEnabled → 否则 VENUE_NOT_BOOKABLE
// （规划裁决 §7-1：场地不存在同样返回 VENUE_NOT_BOOKABLE）。
export function stepBookableVenue(ctx: MockContext, resourceId: number): Target {
  const resource = ctx.state.resources.find((candidate) => candidate.id === resourceId)
  const venue = resource === undefined ? undefined : ctx.state.venues.find((candidate) => candidate.id === resource.venueId)
  if (resource === undefined || venue === undefined || venue.operationalStatus !== 'OPEN' || !venue.userBookingEnabled) {
    return fail('VENUE_NOT_BOOKABLE')
  }
  return { resource, venue }
}

// 第 3 步：场地状态为 OPEN → 否则 RESOURCE_UNAVAILABLE。
export function stepResourceOpen(resource: ResourceRecord): void {
  if (resource.operationalStatus !== 'OPEN') {
    fail('RESOURCE_UNAVAILABLE')
  }
}

// 第 4 步：serviceDate ∈ [今天, 今天 + advanceDays) → 否则 DATE_OUT_OF_RANGE。
export function stepDateInRange(ctx: MockContext, serviceDate: string): void {
  if (!isWithinAdvance(dateOf(ctx.clock.now()), ctx.rules.advanceDays, serviceDate)) {
    fail('DATE_OUT_OF_RANGE', { advanceDays: ctx.rules.advanceDays })
  }
}

// 第 5 步：(serviceDate, startTime) 是该场地当日派生出的合法时段，且不在关闭规则内 → 否则 SLOT_NOT_AVAILABLE。
export function stepDerivedSlot(ctx: MockContext, target: Target, serviceDate: string, startTime: string): void {
  const derived = isDerivedSlot(ctx.state, target.venue.id, serviceDate, startTime)
  if (!derived || isClosedByRule(ctx.state, target.venue.id, target.resource.id, serviceDate)) {
    fail('SLOT_NOT_AVAILABLE')
  }
}

// 第 6 步：开始时间晚于当前时刻 → 否则 SLOT_IN_PAST。
export function stepNotPast(ctx: MockContext, serviceDate: string, startTime: string): void {
  if (slotSeconds(serviceDate, startTime) <= nowSeconds(ctx)) {
    fail('SLOT_IN_PAST')
  }
}

// 第 7 步：未超过 maxActiveReservationsPerUser（未结束的 CONFIRMED 预约）→ 否则 BOOKING_LIMIT_REACHED。
export function stepUnderLimit(ctx: MockContext, user: UserRecord): void {
  const now = nowSeconds(ctx)
  const held = ctx.state.reservations.filter(
    (record) => record.userId === user.id && record.status === 'CONFIRMED' && endSeconds(record) > now,
  ).length
  if (held >= ctx.rules.maxActiveReservationsPerUser) {
    fail('BOOKING_LIMIT_REACHED', { max: ctx.rules.maxActiveReservationsPerUser })
  }
}

// 第 8 步：该时段没有有效预约（前置检查，给友好提示）→ 否则 SLOT_TAKEN。
export function stepSlotFree(ctx: MockContext, resourceId: number, serviceDate: string, startTime: string): void {
  if (findActiveReservation(ctx.state, resourceId, serviceDate, startTime) !== undefined) {
    fail('SLOT_TAKEN')
  }
}

export interface ReservationDraft {
  userId: number
  resourceId: number
  serviceDate: string
  startTime: string
  purpose: string | null
}

// 第 9 步：插入，status = CONFIRMED，end_time 由服务端算出。
// 插入层再检查一次唯一性，模拟 uq_reservation_active_slot 部分唯一索引（docs/13 第 3.5 节）：
// 即使绕过第 8 步，冲突也必须是 SLOT_TAKEN，不会产生第二条有效预约。
export function insertReservation(ctx: MockContext, draft: ReservationDraft): ReservationRecord {
  if (findActiveReservation(ctx.state, draft.resourceId, draft.serviceDate, draft.startTime) !== undefined) {
    fail('SLOT_TAKEN')
  }
  const record: ReservationRecord = {
    id: nextId(ctx.state, 'reservation'),
    userId: draft.userId, resourceId: draft.resourceId,
    serviceDate: draft.serviceDate, startTime: draft.startTime, endTime: endTimeOf(draft.startTime),
    status: 'CONFIRMED', purpose: draft.purpose, createdAt: ctx.clock.now(),
    cancelledAt: null, cancelledBy: null, cancelReason: null, adminNote: null,
    checkInAt: null, checkOutAt: null,
  }
  ctx.state.reservations.push(record)
  return record
}

// 第 2–8 步依次执行。
export function checkCreatable(ctx: MockContext, user: UserRecord, request: CreateReservationRequest): void {
  const target = stepBookableVenue(ctx, request.resourceId)
  stepResourceOpen(target.resource)
  stepDateInRange(ctx, request.serviceDate)
  stepDerivedSlot(ctx, target, request.serviceDate, request.startTime)
  stepNotPast(ctx, request.serviceDate, request.startTime)
  stepUnderLimit(ctx, user)
  stepSlotFree(ctx, request.resourceId, request.serviceDate, request.startTime)
}
