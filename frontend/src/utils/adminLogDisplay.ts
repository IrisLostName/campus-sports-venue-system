// 操作记录的展示口径（FE-5 P8）。docs 没有 LogAction / LogTargetType 的中文名，由 FE-5 施工拟定（FE-5 裁决 Q12 已认可）。
// Record 的键是完整枚举，漏掉任何一个都会编译失败。before / after 只做格式化 JSON，不解释。
import type { LogAction, LogTargetType, OperationLog } from '../api/types'
import { formatTimestamp } from './reservationDisplay'

export const LOG_ACTION_LABELS: Record<LogAction, string> = {
  RESERVATION_CANCEL: '取消预约',
  RESERVATION_REASSIGN_RESOURCE: '改派场地',
  RESERVATION_REASSIGN_USER: '改派预约人',
  RESOURCE_STATUS_CHANGE: '变更场地状态',
  RESOURCE_COUNT_CHANGE: '调整场地数量',
  VENUE_UPDATE: '修改场馆资料',
  RULE_WEEKLY_UPDATE: '修改每周开放窗口',
  CLOSURE_ADD: '新增特殊关闭',
  CLOSURE_REMOVE: '移除特殊关闭',
  SCOPE_UPDATE: '调整授权范围',
  USER_CREATE: '创建账号',
  USER_STATUS_CHANGE: '变更账号状态',
  ANNOUNCEMENT_PUBLISH: '发布公告',
  ANNOUNCEMENT_ARCHIVE: '归档公告',
  REPAIR_UPDATE: '更新报修',
}

export const LOG_TARGET_LABELS: Record<LogTargetType, string> = {
  RESERVATION: '预约',
  RESOURCE: '场地',
  VENUE: '场馆',
  RULE: '开放规则',
  USER: '用户',
  SCOPE: '授权范围',
  ANNOUNCEMENT: '公告',
  REPAIR: '报修',
}

export const LOG_ACTION_OPTIONS: { value: LogAction; label: string }[] = (Object.keys(LOG_ACTION_LABELS) as LogAction[])
  .map((value) => ({ value, label: LOG_ACTION_LABELS[value] }))

// null / undefined 没有内容可看，返回 null；其余缩进两格。
export function formatJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value, null, 2)
}

export interface LogRowView {
  id: number
  timeText: string
  adminName: string
  actionLabel: string
  targetText: string
  reasonText: string | null
  before: string | null
  after: string | null
  venueText?: string      // 仅“全部场馆”模式（FE-6 G6）：venueId 为 null 显示“全局”
}

export const GLOBAL_VENUE_TEXT = '全局'

// venueNames 给出时（全部场馆模式）附带场馆列文字。
export function buildLogRow(log: OperationLog, venueNames?: ReadonlyMap<number, string>): LogRowView {
  const target = LOG_TARGET_LABELS[log.targetType]
  const venueText = log.venueId === null ? GLOBAL_VENUE_TEXT : (venueNames?.get(log.venueId) ?? `场馆 #${log.venueId}`)
  return {
    id: log.id,
    timeText: formatTimestamp(log.createdAt),
    adminName: log.adminName,
    actionLabel: LOG_ACTION_LABELS[log.action],
    targetText: log.targetId === null ? target : `${target} #${log.targetId}`,
    reasonText: log.reason === null || log.reason.trim() === '' ? null : log.reason,
    before: formatJson(log.before),
    after: formatJson(log.after),
    ...(venueNames === undefined ? {} : { venueText }),
  }
}
