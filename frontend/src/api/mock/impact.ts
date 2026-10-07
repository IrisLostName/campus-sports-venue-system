// 影响检查通用机制（docs/12 第 5.5 节“影响检查”六条；docs/03 第 6 节；docs/10 第 5 节）。
// 适用于场馆关闭、场地状态、场地数量、周开放窗口、特殊关闭五类变更（规划裁决 A9）。
import type { ImpactChangeResponse, ImpactReport, LogAction, OnExisting } from '../types'
import { fail } from './fail'
import { appendLog, snapshot } from './logService'
import { ON_EXISTING } from './enums'
import { endSeconds, nowSeconds, toBrief, venueIdOfReservation } from './reservationView'
import { sliceWindow } from './slotDerivation'
import type { MockContext, ReservationRecord, UserRecord } from './state'
import { weekdayOf } from './timeMath'
import { isBlank, oneOfProblem, optional, type FieldCheck } from './validate'

export interface ImpactControl { onExistingReservations?: OnExisting; reason?: string; dryRun?: boolean }

const REASON_MAX = 200

export function reasonProblem(value: unknown): string | null {
  return typeof value === 'string' && value.length <= REASON_MAX ? null : `应为不超过 ${REASON_MAX} 字的文本`
}

// 格式阶段：控制字段本身的合法性。
export function impactControlChecks(control: ImpactControl): FieldCheck[] {
  return [
    ['onExistingReservations', optional(control.onExistingReservations, (value) => oneOfProblem(value, ON_EXISTING))],
    ['reason', optional(control.reason, reasonProblem)],
    ['dryRun', optional(control.dryRun, (value) => (typeof value === 'boolean' ? null : '应为布尔值'))],
  ]
}

// 第 4 条：选择 CANCEL 必须带 reason，否则 REASON_REQUIRED（与格式校验同属请求体阶段；dryRun 只计算，不要求）。
export function requireCancelReason(control: ImpactControl): void {
  if (control.dryRun !== true && control.onExistingReservations === 'CANCEL' && isBlank(control.reason)) {
    fail('REASON_REQUIRED')
  }
}

// “受影响预约”：CONFIRMED 且 end_time 在未来（12 第 5.5 节末段）。
function futureConfirmed(ctx: MockContext): ReservationRecord[] {
  const now = nowSeconds(ctx)
  return ctx.state.reservations.filter((record) => record.status === 'CONFIRMED' && endSeconds(record) > now)
}

export function affectedByResources(ctx: MockContext, resourceIds: number[]): ReservationRecord[] {
  return futureConfirmed(ctx).filter((record) => resourceIds.includes(record.resourceId))
}

export function affectedByVenue(ctx: MockContext, venueId: number): ReservationRecord[] {
  return futureConfirmed(ctx).filter((record) => venueIdOfReservation(ctx, record) === venueId)
}

// 落入新增关闭范围：整馆（resourceId 为 null）或单个场地，日期范围含两端。
export function affectedByClosure(
  ctx: MockContext, venueId: number, resourceId: number | null, startDate: string, endDate: string,
): ReservationRecord[] {
  return affectedByVenue(ctx, venueId).filter((record) =>
    (resourceId === null || record.resourceId === resourceId)
    && record.serviceDate >= startDate && record.serviceDate <= endDate)
}

export interface WindowShape { weekday: number; openTime: string; closeTime: string }

// 时段不再落在新的开放窗口内：预约的开始时间不是新窗口按 90 分钟切出的时段。
export function affectedByWindows(ctx: MockContext, venueId: number, windows: readonly WindowShape[]): ReservationRecord[] {
  return affectedByVenue(ctx, venueId).filter((record) => {
    const weekday = weekdayOf(record.serviceDate)
    return !windows
      .filter((window) => window.weekday === weekday)
      .flatMap((window) => sliceWindow(window.openTime, window.closeTime))
      .some((slot) => slot.startTime === record.startTime)
  })
}

function buildImpact(ctx: MockContext, affected: ReservationRecord[]): ImpactReport {
  return { affectedCount: affected.length, reservations: affected.map((record) => toBrief(ctx, record)) }
}

// 第 4 条：CANCEL → 受影响预约置 ADMIN_CANCELLED，admin_note = reason。
function cancelAffected(ctx: MockContext, admin: UserRecord, affected: ReservationRecord[], reason: string | undefined): number[] {
  for (const record of affected) {
    record.status = 'ADMIN_CANCELLED'
    record.cancelledAt = ctx.clock.now()
    record.cancelledBy = admin.id
    record.adminNote = reason ?? null
  }
  return affected.map((record) => record.id)
}

export interface ImpactPlan<T> {
  affected: ReservationRecord[]
  before: unknown               // 变更前对象的快照（由调用方在 commit 之前取）
  venueId: number
  action: LogAction | null       // null = 该变更没有对应的日志枚举值，不写日志
  targetId: number | null | ((data: T) => number | null)   // 新建对象的 id 要在 commit 之后才知道
  commit(): T                   // 修改状态并返回变更后的对象
}

export function applyImpactChange<T>(
  ctx: MockContext, admin: UserRecord, control: ImpactControl, plan: ImpactPlan<T>,
): ImpactChangeResponse<T> {
  const impact = buildImpact(ctx, plan.affected)
  // 第 1 条：dryRun=true 只计算，不修改任何数据。
  if (control.dryRun === true) {
    return { applied: false, impact, cancelledIds: [], data: null }
  }
  // 第 2 条：存在受影响预约而未给出 onExistingReservations → 409。
  if (plan.affected.length > 0 && control.onExistingReservations === undefined) {
    fail('IMPACT_CONFIRMATION_REQUIRED', { impact })
  }
  const data = plan.commit()
  const cancelledIds = control.onExistingReservations === 'CANCEL'
    ? cancelAffected(ctx, admin, plan.affected, control.reason)
    : []
  const affectedIds = plan.affected.map((record) => record.id)
  if (plan.action !== null) {
    appendLog(ctx, admin, {
      venueId: plan.venueId, action: plan.action, targetId: typeof plan.targetId === 'function' ? plan.targetId(data) : plan.targetId, reason: control.reason ?? null,
      before: snapshot(plan.before, affectedIds), after: snapshot(data, affectedIds),
    })
  }
  return { applied: true, impact, cancelledIds, data }
}
