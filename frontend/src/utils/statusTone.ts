// 状态 → 色调（docs/17 第 6 节）。只决定颜色：不改变任何状态判断，也不碰中文名（名称仍在各自的 *Display 模块里）。
// Record 的键是完整枚举，漏掉任何一个状态都会编译失败。
import type { DisplayStatus, RepairStatus, ResourceLiveState, SlotStatus } from '../api/types'

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

const DISPLAY_STATUS_TONES: Record<DisplayStatus, Tone> = {
  UPCOMING: 'success',
  CHECKIN_OPEN: 'accent',
  IN_USE: 'success',
  CHECKED_OUT: 'neutral',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'danger',
  ADMIN_CANCELLED: 'danger',
}

const SLOT_STATUS_TONES: Record<SlotStatus, Tone> = {
  AVAILABLE: 'success',
  MINE: 'accent',
  BOOKED: 'neutral',
  CLOSED: 'neutral',
  PAST: 'neutral',
}

const RESOURCE_STATE_TONES: Record<ResourceLiveState, Tone> = {
  FREE: 'success',
  RESERVED: 'warning',
  IN_USE: 'accent',
  MAINTENANCE: 'danger',
  DISABLED: 'neutral',
}

const REPAIR_STATUS_TONES: Record<RepairStatus, Tone> = {
  SUBMITTED: 'warning',
  IN_PROGRESS: 'accent',
  RESOLVED: 'success',
}

export function toneForDisplayStatus(status: DisplayStatus): Tone {
  return DISPLAY_STATUS_TONES[status]
}

export function toneForSlotStatus(status: SlotStatus): Tone {
  return SLOT_STATUS_TONES[status]
}

export function toneForResourceState(state: ResourceLiveState): Tone {
  return RESOURCE_STATE_TONES[state]
}

export function toneForRepairStatus(status: RepairStatus): Tone {
  return REPAIR_STATUS_TONES[status]
}
