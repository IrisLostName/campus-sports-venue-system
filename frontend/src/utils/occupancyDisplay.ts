// 场地占用总览的展示口径（FE-5 P5）：场地 × 时段网格。状态取接口返回值，前端不推导（docs/16 第 5 节第 3 项）。
// 格子状态沿用订场页的中文名（SLOT_STATUS_LABELS）与 docs/17 第 6 节的 SlotStatus 色调，BOOKED 同 SlotStatus。
import type { Occupancy, OccupancySlot } from '../api/typesSection5'
import { SLOT_STATUS_LABELS } from './bookingDisplay'
import { RESOURCE_STATUS_LABELS } from './adminResourceDisplay'
import { displayStatusLabel } from './reservationDisplay'
import { toneForDisplayStatus, toneForResourceStatus, toneForSlotStatus, type Tone } from './statusTone'

export interface OccupancyCellView {
  startTime: string
  status: OccupancySlot['status']
  statusLabel: string
  tone: Tone
  reservation: { id: number; userDisplayName: string; statusLabel: string; tone: Tone } | null
}

export interface OccupancyRowView {
  resourceId: number
  resourceName: string
  statusLabel: string
  statusTone: Tone
  cells: (OccupancyCellView | null)[]    // 与 columns 一一对应；该场地没有此时段时为 null
}

export interface OccupancyGridView {
  columns: { startTime: string; timeText: string }[]
  rows: OccupancyRowView[]
}

function buildCell(slot: OccupancySlot): OccupancyCellView {
  return {
    startTime: slot.startTime,
    status: slot.status,
    statusLabel: SLOT_STATUS_LABELS[slot.status],
    tone: toneForSlotStatus(slot.status),
    reservation: slot.reservation === null ? null : {
      id: slot.reservation.id,
      userDisplayName: slot.reservation.userDisplayName,
      statusLabel: displayStatusLabel(slot.reservation.displayStatus),
      tone: toneForDisplayStatus(slot.reservation.displayStatus),
    },
  }
}

// 列是所有场地出现过的开始时间（升序）；场地顺序保持接口返回的顺序（接口按 sortOrder 排，FE-5 裁决 Q10）。
export function buildOccupancyGrid(occupancy: Occupancy): OccupancyGridView {
  const ends = new Map<string, string>()
  for (const resource of occupancy.resources) {
    for (const slot of resource.slots) {
      ends.set(slot.startTime, slot.endTime)
    }
  }
  const columns = [...ends.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startTime, endTime]) => ({ startTime, timeText: `${startTime}–${endTime}` }))
  return {
    columns,
    rows: occupancy.resources.map((resource) => ({
      resourceId: resource.resourceId,
      resourceName: resource.resourceName,
      statusLabel: RESOURCE_STATUS_LABELS[resource.operationalStatus],
      statusTone: toneForResourceStatus(resource.operationalStatus),
      cells: columns.map((column) => {
        const slot = resource.slots.find((item) => item.startTime === column.startTime)
        return slot === undefined ? null : buildCell(slot)
      }),
    })),
  }
}
