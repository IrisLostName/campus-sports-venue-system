// docs/12 第 5.6 节：开放规则（每周窗口整体替换、特殊关闭）；校验见 docs/03 第 3 节、docs/13 第 3.4 节。
import type { ApiClient } from '../client'
import type { ImpactChangeResponse } from '../types'
import type { AddClosureRequest, AvailabilityRulesResponse, ReplaceWeeklyRulesRequest, WeeklyWindowInput } from '../requests'
import type { Closure, WeeklyWindow } from '../typesSection5'
import { SLOT_MINUTES } from './bookingRules'
import { fail } from './fail'
import { authenticate, requireRole, requireScope } from './guards'
import {
  affectedByClosure, affectedByWindows, applyImpactChange, impactControlChecks, requireCancelReason,
} from './impact'
import { appendLog, snapshot } from './logService'
import { getOrFail } from './lookup'
import { run } from './run'
import { nextId, type ClosureRecord, type MockContext, type WeeklyRecord } from './state'
import { toMinutes } from './timeMath'
import { collect, dateProblem, intProblem, optional, timeProblem, type FieldCheck } from './validate'

function toWeekly(record: WeeklyRecord): WeeklyWindow {
  return { id: record.id, weekday: record.weekday, openTime: record.openTime, closeTime: record.closeTime }
}

function toClosure(record: ClosureRecord): Closure {
  return {
    id: record.id, venueId: record.venueId, resourceId: record.resourceId,
    startDate: record.startDate, endDate: record.endDate, reason: record.reason,
  }
}

function activeWeekly(ctx: MockContext, venueId: number): WeeklyWindow[] {
  return ctx.state.weekly
    .filter((record) => record.venueId === venueId && record.status === 'ACTIVE')
    .sort((a, b) => a.weekday - b.weekday || a.openTime.localeCompare(b.openTime))
    .map(toWeekly)
}

function activeClosures(ctx: MockContext, venueId: number): Closure[] {
  return ctx.state.closures
    .filter((record) => record.venueId === venueId && record.status === 'ACTIVE')
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id)
    .map(toClosure)
}

function getAvailabilityRules(ctx: MockContext, venueId: number): AvailabilityRulesResponse {
  const user = authenticate(ctx)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  return { weekly: activeWeekly(ctx, venue.id), closures: activeClosures(ctx, venue.id) }
}

function windowChecks(windows: WeeklyWindowInput[]): FieldCheck[] {
  if (!Array.isArray(windows)) {
    return [['windows', '应为数组']]
  }
  return windows.flatMap((window, index): FieldCheck[] => [
    [`windows[${index}].weekday`, intProblem(window.weekday, 1, 7)],
    [`windows[${index}].openTime`, timeProblem(window.openTime)],
    [`windows[${index}].closeTime`, timeProblem(window.closeTime)],
  ])
}

// docs/03 第 3 节第 3 条：窗口长度必须是 90 分钟整数倍；同一星期的窗口不得重叠；开始须早于结束。失败 RULE_INVALID。
function ruleViolation(windows: readonly WeeklyWindowInput[]): string | null {
  for (const window of windows) {
    const length = toMinutes(window.closeTime) - toMinutes(window.openTime)
    if (length <= 0) {
      return '开始时间不早于结束时间'
    }
    if (length % SLOT_MINUTES !== 0) {
      return `窗口长度必须是 ${SLOT_MINUTES} 分钟的整数倍`
    }
  }
  const ordered = [...windows].sort((a, b) => a.weekday - b.weekday || a.openTime.localeCompare(b.openTime))
  const overlap = ordered.some((window, index) => {
    const previous = ordered[index - 1]
    return previous !== undefined && previous.weekday === window.weekday && window.openTime < previous.closeTime
  })
  return overlap ? '同一星期的窗口不能重叠' : null
}

function replaceWeekly(
  ctx: MockContext, venueId: number, request: ReplaceWeeklyRulesRequest,
): ImpactChangeResponse<WeeklyWindow[]> {
  const user = authenticate(ctx)
  collect([...windowChecks(request.windows), ...impactControlChecks(request)])
  requireCancelReason(request)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  const violation = ruleViolation(request.windows)
  if (violation !== null) {
    fail('RULE_INVALID', { reason: violation })
  }
  return applyImpactChange(ctx, user, request, {
    affected: affectedByWindows(ctx, venue.id, request.windows),
    before: activeWeekly(ctx, venue.id), venueId: venue.id, action: 'RULE_WEEKLY_UPDATE', targetId: null,
    commit: () => {
      ctx.state.weekly
        .filter((record) => record.venueId === venue.id && record.status === 'ACTIVE')
        .forEach((record) => { record.status = 'INACTIVE' })
      for (const window of request.windows) {
        ctx.state.weekly.push({ id: nextId(ctx.state, 'weekly'), venueId: venue.id, status: 'ACTIVE', ...window })
      }
      return activeWeekly(ctx, venue.id)
    },
  })
}

// 规划裁决 A8：endDate < startDate → RULE_INVALID（一天的关闭 = startDate 与 endDate 相同）；日期格式错误 → VALIDATION_ERROR；
// 不禁止过去日期。resourceId 必须是本场馆的场地。
function addClosure(ctx: MockContext, venueId: number, request: AddClosureRequest): ImpactChangeResponse<Closure> {
  const user = authenticate(ctx)
  collect([
    ['startDate', dateProblem(request.startDate)],
    ['endDate', dateProblem(request.endDate)],
    ['resourceId', optional(request.resourceId, (value) => intProblem(value))],
    ...impactControlChecks(request),
  ])
  requireCancelReason(request)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  if (request.endDate < request.startDate) {
    fail('RULE_INVALID', { reason: '结束日期不能早于开始日期' })
  }
  const resourceId = request.resourceId ?? null
  if (resourceId !== null && !ctx.state.resources.some((r) => r.id === resourceId && r.venueId === venue.id)) {
    fail('VALIDATION_ERROR', { fields: { resourceId: '场地不属于该场馆' } })
  }
  return applyImpactChange(ctx, user, request, {
    affected: affectedByClosure(ctx, venue.id, resourceId, request.startDate, request.endDate),
    before: null, venueId: venue.id, action: 'CLOSURE_ADD', targetId: (data) => data.id,
    commit: () => {
      const record: ClosureRecord = {
        id: nextId(ctx.state, 'closure'), venueId: venue.id, resourceId,
        startDate: request.startDate, endDate: request.endDate, reason: request.reason ?? null, status: 'ACTIVE',
      }
      ctx.state.closures.push(record)
      return toClosure(record)
    },
  })
}

// 规划裁决 A9：删除（停用）关闭规则不做影响检查，返回 204，写日志。
function removeClosure(ctx: MockContext, id: number): void {
  const user = authenticate(ctx)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const record = getOrFail(ctx.state.closures, id)
  if (record.status !== 'ACTIVE') {
    fail('NOT_FOUND')
  }
  requireScope(ctx, user, record.venueId)
  const before = toClosure(record)
  record.status = 'INACTIVE'
  appendLog(ctx, user, {
    venueId: record.venueId, action: 'CLOSURE_REMOVE', targetId: record.id,
    before: snapshot(before), after: snapshot(null),
  })
}

export type RuleApi = Pick<ApiClient,
  'adminGetAvailabilityRules' | 'adminReplaceWeeklyRules' | 'adminAddClosure' | 'adminRemoveClosure'>

export function ruleApi(ctx: MockContext): RuleApi {
  return {
    adminGetAvailabilityRules: (venueId) => run(ctx, () => getAvailabilityRules(ctx, venueId)),
    adminReplaceWeeklyRules: (venueId, request) => run(ctx, () => replaceWeekly(ctx, venueId, request)),
    adminAddClosure: (venueId, request) => run(ctx, () => addClosure(ctx, venueId, request)),
    adminRemoveClosure: (id) => run(ctx, () => removeClosure(ctx, id)),
  }
}
