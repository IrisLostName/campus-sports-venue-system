// 订场页的展示口径（FE-4 规划裁决 B2、B4、B5、B7）。
// 时段状态只取接口返回值，前端不推导（docs/16 第 5 节第 3 项）：这里只把状态翻译成文案并回答“能不能选”。
import type { ResourceSlots, SlotItem, SlotStatus } from '../api/types'
import { weekdayName } from './reservationDisplay'

export const NOT_BOOKABLE_TEXT = '暂未开放预约'

// 用途输入框的长度上限，对应 docs/13 的 purpose VARCHAR(200)。
export const PURPOSE_MAX_LENGTH = 200

// B5：状态中文名。
export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  AVAILABLE: '可预约',
  BOOKED: '已被预约',
  MINE: '我的预约',
  CLOSED: '不开放',
  PAST: '已过',
}

// B5：只有 AVAILABLE 可选；MINE 醒目标出但不可选；BOOKED、CLOSED、PAST 置灰不可选。
export function isSelectable(status: SlotStatus): boolean {
  return status === 'AVAILABLE'
}

export interface SlotCell {
  startTime: string
  timeText: string
  status: SlotStatus
  label: string
  selectable: boolean
  selected: boolean
}

export function buildSlotCell(slot: SlotItem, selectedStart: string | null): SlotCell {
  return {
    startTime: slot.startTime,
    timeText: `${slot.startTime}–${slot.endTime}`,
    status: slot.status,
    label: SLOT_STATUS_LABELS[slot.status],
    selectable: isSelectable(slot.status),
    selected: selectedStart === slot.startTime,
  }
}

export interface SlotPick {
  resourceId: number
  startTime: string
}

export interface SlotGroup {
  resourceId: number
  resourceName: string
  cells: SlotCell[]
}

// B5：按场地分组；picked 是当前选中的那一格。
export function buildSlotGroups(resources: ResourceSlots[], picked: SlotPick | null): SlotGroup[] {
  return resources.map((resource) => ({
    resourceId: resource.resourceId,
    resourceName: resource.resourceName,
    cells: resource.slots.map((slot) => buildSlotCell(
      slot, picked?.resourceId === resource.resourceId ? picked.startTime : null,
    )),
  }))
}

// 重新拉取之后，所选的那一格是否仍是 AVAILABLE。
export function isPickStillOpen(resources: ResourceSlots[], picked: SlotPick): boolean {
  return resources.some((resource) => resource.resourceId === picked.resourceId
    && resource.slots.some((slot) => slot.startTime === picked.startTime && isSelectable(slot.status)))
}

export interface DateOption {
  value: string          // YYYY-MM-DD，作为请求参数
  dayText: string        // MM-DD
  weekdayText: string    // 周二
}

// 日期加减按 UTC 字段做，与浏览器所在时区无关。
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`日期格式不对：${date}`)
  }
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 'YYYY-MM-DD'.length)
}

// B4：日期选项为 [今天, 今天 + advanceDays)，共 advanceDays 个。
export function dateOptions(today: string, advanceDays: number): DateOption[] {
  return Array.from({ length: advanceDays }, (_unused, offset) => {
    const value = addDays(today, offset)
    const weekday = weekdayName(value)
    return { value, dayText: value.slice('YYYY-'.length), weekdayText: weekday === null ? '' : `周${weekday}` }
  })
}
