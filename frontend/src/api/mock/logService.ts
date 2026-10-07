// 管理员操作留痕（docs/12 第 4 节 OperationLog、第 5.5 节影响检查第 6 条；docs/13 第 3.10 节）。
// action 与 targetType 只使用 docs/12 第 2 节的枚举值；没有对应枚举的操作不写日志（规划裁决 §7-7）：
//   不记：POST /admin/venues；仅改 displayName 的 PATCH /admin/users；改场地名称/排序。
import type { ApiClient } from '../client'
import type { LogAction, LogTargetType, OperationLog, Page } from '../types'
import type { LogsQuery } from '../requests'
import { authenticate, hasScope, requireRole } from './guards'
import { fail } from './fail'
import { pageOf } from './paging'
import { run } from './run'
import { nextId, type MockContext, type UserRecord } from './state'
import { dateOf } from './timeMath'
import { collect, dateProblem, intProblem, oneOfProblem, optional, pagingChecks } from './validate'

// 每个操作固定对应的 targetType。targetId 约定见各调用处：
//   RESERVATION_* → 预约 id；RESOURCE_STATUS_CHANGE → 场地 id；RESOURCE_COUNT_CHANGE、VENUE_UPDATE → 场馆 id；
//   RULE_WEEKLY_UPDATE → null（整体替换，无单一目标）；CLOSURE_ADD/REMOVE → 关闭规则 id；
//   SCOPE_UPDATE → 被授权的管理员 id；USER_* → 用户 id；ANNOUNCEMENT_* → 公告 id；REPAIR_UPDATE → 报修 id。
export const LOG_TARGET: Record<LogAction, LogTargetType> = {
  RESERVATION_CANCEL: 'RESERVATION',
  RESERVATION_REASSIGN_RESOURCE: 'RESERVATION',
  RESERVATION_REASSIGN_USER: 'RESERVATION',
  RESOURCE_STATUS_CHANGE: 'RESOURCE',
  RESOURCE_COUNT_CHANGE: 'VENUE',
  VENUE_UPDATE: 'VENUE',
  RULE_WEEKLY_UPDATE: 'RULE',
  CLOSURE_ADD: 'RULE',
  CLOSURE_REMOVE: 'RULE',
  SCOPE_UPDATE: 'SCOPE',
  USER_CREATE: 'USER',
  USER_STATUS_CHANGE: 'USER',
  ANNOUNCEMENT_PUBLISH: 'ANNOUNCEMENT',
  ANNOUNCEMENT_ARCHIVE: 'ANNOUNCEMENT',
  REPAIR_UPDATE: 'REPAIR',
}

export interface LogEntry {
  venueId: number | null
  action: LogAction
  targetId: number | null
  reason?: string | null
  before: unknown
  after: unknown
}

// 前后快照的统一形状（规划裁决 A9）：{ object: 变更前/后的对象, affectedReservationIds: number[] }。
export function snapshot(object: unknown, affectedReservationIds: number[] = []): unknown {
  return { object: structuredClone(object), affectedReservationIds: [...affectedReservationIds] }
}

export function appendLog(ctx: MockContext, admin: UserRecord, entry: LogEntry): void {
  ctx.state.logs.push({
    id: nextId(ctx.state, 'log'),
    adminId: admin.id,
    adminName: admin.displayName,
    venueId: entry.venueId,
    action: entry.action,
    targetType: LOG_TARGET[entry.action],
    targetId: entry.targetId,
    reason: entry.reason ?? null,
    before: entry.before,
    after: entry.after,
    createdAt: ctx.clock.now(),
  })
}

function validateLogsQuery(query: LogsQuery): void {
  collect([
    ['venueId', optional(query.venueId, (value) => intProblem(value))],
    ['action', optional(query.action, (value) => oneOfProblem(value, Object.keys(LOG_TARGET)))],
    ['dateFrom', optional(query.dateFrom, dateProblem)],
    ['dateTo', optional(query.dateTo, dateProblem)],
    ...pagingChecks(query.page, query.pageSize),
  ])
}

// VA 只能看到 venueId 属于授权场馆的日志；venueId 为 null 的日志对 VA 不可见；
// VA 指定授权范围之外的 venueId → FORBIDDEN_SCOPE（规划裁决 §7-8）。
function visibleLogs(ctx: MockContext, user: UserRecord, query: LogsQuery): OperationLog[] {
  if (query.venueId !== undefined && !hasScope(ctx, user, query.venueId)) {
    fail('FORBIDDEN_SCOPE', { venueId: query.venueId })
  }
  return ctx.state.logs.filter((log) => {
    const inScope = user.role === 'SYS_ADMIN' || (log.venueId !== null && hasScope(ctx, user, log.venueId))
    const day = dateOf(log.createdAt)
    return inScope
      && (query.venueId === undefined || log.venueId === query.venueId)
      && (query.action === undefined || log.action === query.action)
      && (query.dateFrom === undefined || day >= query.dateFrom)
      && (query.dateTo === undefined || day <= query.dateTo)
  })
}

function listLogs(ctx: MockContext, query: LogsQuery): Page<OperationLog> {
  const user = authenticate(ctx)
  validateLogsQuery(query)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const logs = visibleLogs(ctx, user, query)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  return pageOf(logs, query.page, query.pageSize)
}

export function logApi(ctx: MockContext): Pick<ApiClient, 'adminListLogs'> {
  return { adminListLogs: (query = {}) => run(ctx, () => listLogs(ctx, query)) }
}
