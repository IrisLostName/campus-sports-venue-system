// 时段派生（docs/03 第 3、3.1 节）：时段不落表，由每周开放窗口按 90 分钟切分，再扣除关闭规则。
import type { ReservationStatus, SlotStatus } from '../types'
import { SLOT_MINUTES } from './bookingRules'
import type { MockState, ReservationRecord, ResourceRecord, VenueRecord } from './state'
import { fromMinutes, toMinutes, weekdayOf } from './timeMath'

export interface DerivedSlot { startTime: string; endTime: string }

// 有效 = 状态不是 CANCELLED / ADMIN_CANCELLED（03 第 4.1 节，对应 13 的部分唯一索引条件）。
export function isActiveStatus(status: ReservationStatus): boolean {
  return status !== 'CANCELLED' && status !== 'ADMIN_CANCELLED'
}

// 03 第 3 节第 2 步：start = open + 90k，end = start + 90，k = 0 … n-1，n = (close − open) / 90。
export function sliceWindow(openTime: string, closeTime: string): DerivedSlot[] {
  const open = toMinutes(openTime)
  const count = Math.floor((toMinutes(closeTime) - open) / SLOT_MINUTES)
  return Array.from({ length: Math.max(count, 0) }, (_, k) => ({
    startTime: fromMinutes(open + SLOT_MINUTES * k),
    endTime: fromMinutes(open + SLOT_MINUTES * (k + 1)),
  }))
}

// 03 第 3 节第 1 步：该场馆当天星期对应的 ACTIVE 每周窗口；按开始时间排序。
export function deriveSlots(state: MockState, venueId: number, date: string): DerivedSlot[] {
  const weekday = weekdayOf(date)
  return state.weekly
    .filter((window) => window.venueId === venueId && window.status === 'ACTIVE' && window.weekday === weekday)
    .flatMap((window) => sliceWindow(window.openTime, window.closeTime))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// 03 第 3 节第 4 步：整馆关闭（resourceId 为空）作用于全馆，否则只作用于该场地；日期范围含两端。
export function isClosedByRule(state: MockState, venueId: number, resourceId: number, date: string): boolean {
  return state.closures.some((closure) =>
    closure.venueId === venueId && closure.status === 'ACTIVE'
    && (closure.resourceId === null || closure.resourceId === resourceId)
    && closure.startDate <= date && date <= closure.endDate)
}

// 03 第 3 节第 5 步：场馆或场地状态不是 OPEN，该范围内没有可预约时段。
export function isUnavailable(venue: VenueRecord, resource: ResourceRecord, closedByRule: boolean): boolean {
  return venue.operationalStatus !== 'OPEN' || resource.operationalStatus !== 'OPEN' || closedByRule
}

export function findActiveReservation(
  state: MockState, resourceId: number, date: string, startTime: string, exceptId?: number,
): ReservationRecord | undefined {
  return state.reservations.find((reservation) =>
    reservation.id !== exceptId && reservation.resourceId === resourceId
    && reservation.serviceDate === date && reservation.startTime === startTime
    && isActiveStatus(reservation.status))
}

export function isDerivedSlot(state: MockState, venueId: number, date: string, startTime: string): boolean {
  return deriveSlots(state, venueId, date).some((slot) => slot.startTime === startTime)
}

export interface SlotFacts {
  isPast: boolean                                // 开始时间不晚于当前时刻
  reservation: ReservationRecord | undefined     // 该时段的有效预约
  unavailable: boolean                           // 关闭规则、维护、停用或场馆关闭
}

// 规划裁决 A7：优先级 PAST > MINE/BOOKED > CLOSED > AVAILABLE。
export function resolveSlotStatus(facts: SlotFacts, viewerId: number | null): SlotStatus {
  if (facts.isPast) {
    return 'PAST'
  }
  if (facts.reservation !== undefined) {
    return facts.reservation.userId === viewerId ? 'MINE' : 'BOOKED'
  }
  return facts.unavailable ? 'CLOSED' : 'AVAILABLE'
}
