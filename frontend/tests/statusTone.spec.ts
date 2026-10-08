// UI-1：状态 → 色调映射逐项对照 docs/17 第 6 节的表格。期望值在此处按文档重抄一遍，不引用实现里的表。
import { describe, expect, it } from 'vitest'

import type { DisplayStatus, RepairStatus, ResourceLiveState, SlotStatus } from '../src/api/types'
import {
  toneForDisplayStatus, toneForRepairStatus, toneForResourceState, toneForSlotStatus, type Tone,
} from '../src/utils/statusTone'

const DISPLAY: [DisplayStatus, Tone][] = [
  ['CHECKIN_OPEN', 'accent'],
  ['UPCOMING', 'success'], ['IN_USE', 'success'], ['COMPLETED', 'success'],
  ['CANCELLED', 'danger'], ['ADMIN_CANCELLED', 'danger'], ['NO_SHOW', 'danger'],
  ['CHECKED_OUT', 'neutral'],
]
const SLOT: [SlotStatus, Tone][] = [
  ['MINE', 'accent'], ['AVAILABLE', 'success'], ['BOOKED', 'neutral'], ['CLOSED', 'neutral'], ['PAST', 'neutral'],
]
const RESOURCE: [ResourceLiveState, Tone][] = [
  ['IN_USE', 'accent'], ['FREE', 'success'], ['RESERVED', 'warning'], ['MAINTENANCE', 'danger'], ['DISABLED', 'neutral'],
]
const REPAIR: [RepairStatus, Tone][] = [
  ['IN_PROGRESS', 'accent'], ['RESOLVED', 'success'], ['SUBMITTED', 'warning'],
]

describe('docs/17 第 6 节状态 → tone 映射', () => {
  it.each(DISPLAY)('displayStatus %s → %s', (status, tone) => {
    expect(toneForDisplayStatus(status)).toBe(tone)
  })

  it.each(SLOT)('SlotStatus %s → %s', (status, tone) => {
    expect(toneForSlotStatus(status)).toBe(tone)
  })

  it.each(RESOURCE)('ResourceLiveState %s → %s', (state, tone) => {
    expect(toneForResourceState(state)).toBe(tone)
  })

  it.each(REPAIR)('RepairStatus %s → %s', (status, tone) => {
    expect(toneForRepairStatus(status)).toBe(tone)
  })

  it('覆盖完整枚举：文档表中的状态个数与枚举一致（8 / 5 / 5 / 3），没有重复', () => {
    expect([DISPLAY.length, SLOT.length, RESOURCE.length, REPAIR.length]).toEqual([8, 5, 5, 3])
    for (const table of [DISPLAY, SLOT, RESOURCE, REPAIR]) {
      expect(new Set(table.map(([status]) => status)).size).toBe(table.length)
    }
  })
})
