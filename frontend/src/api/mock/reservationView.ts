// 预约的展示视图与时间判定点（docs/03 第 4.3、4.4 节）。前端不推导状态，displayStatus 全部由这里给出。
import type { DisplayStatus, Reservation, ReservationBrief } from '../types'
import type { AdminReservation } from '../typesSection5'
import { getOrFail, venueOfResource } from './lookup'
import type { MockContext, ReservationRecord } from './state'
import { addMinutes, secondsOf, slotSeconds } from './timeMath'

function startTimestamp(record: ReservationRecord): string {
  return `${record.serviceDate}T${record.startTime}:00`
}

function endTimestamp(record: ReservationRecord): string {
  return `${record.serviceDate}T${record.endTime}:00`
}

export function startSeconds(record: ReservationRecord): number {
  return slotSeconds(record.serviceDate, record.startTime)
}

export function endSeconds(record: ReservationRecord): number {
  return slotSeconds(record.serviceDate, record.endTime)
}

export function nowSeconds(ctx: MockContext): number {
  return secondsOf(ctx.clock.now())
}

// 签到窗口：闭区间 [start − checkInOpenBeforeMinutes, start + checkInCloseAfterMinutes]（10 第 4 节）。
export function checkInWindow(ctx: MockContext, record: ReservationRecord): { opensAt: string; closesAt: string } {
  const start = startTimestamp(record)
  return {
    opensAt: addMinutes(start, -ctx.rules.checkInOpenBeforeMinutes),
    closesAt: addMinutes(start, ctx.rules.checkInCloseAfterMinutes),
  }
}

// 签退宽限截止：结束后 checkOutGraceMinutes 分钟，严格小于该时刻才可签退（10 第 4 节）。
export function checkOutDeadlineSeconds(ctx: MockContext, record: ReservationRecord): number {
  return secondsOf(addMinutes(endTimestamp(record), ctx.rules.checkOutGraceMinutes))
}

// 03 第 4.4 节展示状态：与 status 同名的终态，或 CONFIRMED 下的 UPCOMING / CHECKIN_OPEN / IN_USE / CHECKED_OUT。
export function displayStatusOf(ctx: MockContext, record: ReservationRecord): DisplayStatus {
  if (record.status !== 'CONFIRMED') {
    return record.status
  }
  if (record.checkInAt !== null) {
    return record.checkOutAt === null ? 'IN_USE' : 'CHECKED_OUT'
  }
  return nowSeconds(ctx) >= secondsOf(checkInWindow(ctx, record).opensAt) ? 'CHECKIN_OPEN' : 'UPCOMING'
}

// 等价于后台每分钟的幂等清扫（10 第 8 节）：每次调用接口前先把越过判定点的 CONFIRMED 落成 NO_SHOW / COMPLETED。
export function sweep(ctx: MockContext): void {
  const now = nowSeconds(ctx)
  for (const record of ctx.state.reservations) {
    if (record.status !== 'CONFIRMED') {
      continue
    }
    if (record.checkInAt === null && now > secondsOf(checkInWindow(ctx, record).closesAt)) {
      record.status = 'NO_SHOW'
    } else if (record.checkInAt !== null && now >= endSeconds(record)) {
      record.status = 'COMPLETED'
    }
  }
}

export function toReservation(ctx: MockContext, record: ReservationRecord): Reservation {
  const { state } = ctx
  const resource = getOrFail(state.resources, record.resourceId)
  const venue = venueOfResource(state, resource)
  const user = getOrFail(state.users, record.userId)
  return {
    id: record.id,
    venueId: venue.id, venueName: venue.name,
    resourceId: resource.id, resourceName: resource.name,
    userId: user.id, userDisplayName: user.displayName,
    serviceDate: record.serviceDate, startTime: record.startTime, endTime: record.endTime,
    status: record.status, displayStatus: displayStatusOf(ctx, record),
    purpose: record.purpose, createdAt: record.createdAt,
    cancelledAt: record.cancelledAt, cancelReason: record.cancelReason, cancelledBy: record.cancelledBy,
    adminNote: record.adminNote, checkInAt: record.checkInAt, checkOutAt: record.checkOutAt,
  }
}

export function toAdminReservation(ctx: MockContext, record: ReservationRecord): AdminReservation {
  const user = getOrFail(ctx.state.users, record.userId)
  return { ...toReservation(ctx, record), userUsername: user.username, userPhone: user.phone }
}

export function toBrief(ctx: MockContext, record: ReservationRecord): ReservationBrief {
  const resource = getOrFail(ctx.state.resources, record.resourceId)
  const user = getOrFail(ctx.state.users, record.userId)
  return {
    id: record.id, resourceName: resource.name, serviceDate: record.serviceDate,
    startTime: record.startTime, endTime: record.endTime, userDisplayName: user.displayName,
  }
}

export function venueIdOfReservation(ctx: MockContext, record: ReservationRecord): number {
  return venueOfResource(ctx.state, getOrFail(ctx.state.resources, record.resourceId)).id
}
