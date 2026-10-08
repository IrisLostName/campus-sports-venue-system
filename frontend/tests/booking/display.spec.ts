// 订场展示口径的纯函数（FE-4 B4、B5）：日期选项、“今天”按 Asia/Shanghai、时段状态文案与可选性。
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SlotStatus } from '../../src/api/types'
import { addDays, buildSlotCell, dateOptions, isSelectable, NOT_BOOKABLE_TEXT, SLOT_STATUS_LABELS } from '../../src/utils/bookingDisplay'
import { todayShanghai } from '../../src/utils/shanghaiTime'

afterEach(() => {
  vi.useRealTimers()
})

describe('B4 日期选项', () => {
  it('从今天起恰好 advanceDays 个', () => {
    expect(dateOptions('2026-10-12', 7)).toHaveLength(7)
    expect(dateOptions('2026-10-12', 3).map((option) => option.value)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
    expect(dateOptions('2026-10-12', 0)).toEqual([])
  })

  it('每个选项带 MM-DD 与星期', () => {
    expect(dateOptions('2026-10-12', 2)).toEqual([
      { value: '2026-10-12', dayText: '10-12', weekdayText: '周一' },
      { value: '2026-10-13', dayText: '10-13', weekdayText: '周二' },
    ])
  })

  it('跨月、跨年按日历递增', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(dateOptions('2026-12-30', 3).map((option) => option.value)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('日期格式不对时抛错，而不是悄悄给出错误日期', () => {
    expect(() => addDays('not-a-date', 1)).toThrow()
  })
})

describe('今天按 Asia/Shanghai', () => {
  it('UTC 16:00 之后已经是上海的次日', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T15:59:00Z'))
    expect(todayShanghai()).toBe('2026-10-11')

    vi.setSystemTime(new Date('2026-10-11T16:00:00Z'))
    expect(todayShanghai()).toBe('2026-10-12')
  })
})

describe('B5 时段状态', () => {
  it.each<[SlotStatus, string, boolean]>([
    ['AVAILABLE', '可预约', true],
    ['BOOKED', '已被预约', false],
    ['MINE', '我的预约', false],
    ['CLOSED', '不开放', false],
    ['PAST', '已过', false],
  ])('%s → %s，可选：%s', (status, label, selectable) => {
    expect(SLOT_STATUS_LABELS[status]).toBe(label)
    expect(isSelectable(status)).toBe(selectable)
    expect(buildSlotCell({ startTime: '08:00', endTime: '09:30', status }, null)).toEqual({
      startTime: '08:00', timeText: '08:00–09:30', status, label, selectable, selected: false,
    })
  })

  it('选中的那一格带 selected', () => {
    expect(buildSlotCell({ startTime: '08:00', endTime: '09:30', status: 'AVAILABLE' }, '08:00').selected).toBe(true)
    expect(buildSlotCell({ startTime: '09:30', endTime: '11:00', status: 'AVAILABLE' }, '08:00').selected).toBe(false)
  })

  it('未开放文案', () => {
    expect(NOT_BOOKABLE_TEXT).toBe('暂未开放预约')
  })
})
