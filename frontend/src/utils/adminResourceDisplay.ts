// 场地与开放规则的展示口径（FE-5 P3、P5）。
// 状态中文名与色调见 docs/17 第 6 节“ResourceStatus（管理端）”；状态按钮依据 docs/03 第 6 节状态图。
import type { ResourceStatus, ResourceType } from '../api/types'

export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  OPEN: '开放',
  MAINTENANCE: '维护中',
  DISABLED: '已停用',
}

// docs/12 第 2 节 ResourceType 的中文名（FE-5 裁决 Q5）。
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  COURT: '球场',
  LANE: '泳道',
  OTHER: '其他',
}

export const RESOURCE_TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: 'COURT', label: RESOURCE_TYPE_LABELS.COURT },
  { value: 'LANE', label: RESOURCE_TYPE_LABELS.LANE },
  { value: 'OTHER', label: RESOURCE_TYPE_LABELS.OTHER },
]

export interface StatusAction {
  label: string
  target: ResourceStatus
  destructive: boolean
}

// docs/03 第 6 节：OPEN → MAINTENANCE / DISABLED；MAINTENANCE → OPEN / DISABLED；DISABLED → OPEN（FE-5 裁决 Q2）。
export function statusActionsFor(status: ResourceStatus): StatusAction[] {
  switch (status) {
    case 'OPEN':
      return [
        { label: '设为维护', target: 'MAINTENANCE', destructive: false },
        { label: '停用', target: 'DISABLED', destructive: true },
      ]
    case 'MAINTENANCE':
      return [
        { label: '恢复开放', target: 'OPEN', destructive: false },
        { label: '停用', target: 'DISABLED', destructive: true },
      ]
    case 'DISABLED':
      return [{ label: '重新启用', target: 'OPEN', destructive: false }]
  }
}

// docs/12 第 5.6 节：weekday 1–7，周一 = 1。
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === weekday)?.label ?? String(weekday)
}

export const WHOLE_VENUE_TEXT = '整馆'

// docs/13：场地名称上限 50；设定数量表单的名称前缀上限 40（与 mock 一致，FE-5 裁决 Q5、Q8）。
export const RESOURCE_NAME_MAX_LENGTH = 50
export const NAME_PREFIX_MAX_LENGTH = 40
export const RESOURCE_COUNT_MAX = 50
