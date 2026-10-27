// UI-3 裁决第 2 节：日期范围由 advanceDays 决定（31 格月历只有可预约日可选）、键盘移动、媒体约定与缺图占位所用的口径。
import { describe, expect, it } from 'vitest'

import { nextFocusIndex } from '../../src/composables/calendarKeys'
import {
  bookableHint, CALENDAR_SPAN, calendarDays, calendarWeeks, mondayIndex, rangeText,
} from '../../src/utils/bookingCalendar'
import { venueInitial, venueMediaUrl } from '../../src/utils/venueMedia'

const bookableOf = (today: string, advanceDays: number) => calendarDays(today, advanceDays).filter((day) => day.bookable).map((day) => day.value)

describe('calendarDays：从今天起滚动 31 天，前 advanceDays 天可选', () => {
  it('31 格，第一格是今天，逐日递增；advanceDays = 7 时恰好前 7 天可选', () => {
    const days = calendarDays('2026-10-12', 7)

    expect(CALENDAR_SPAN).toBe(31)
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual({ value: '2026-10-12', dayOfMonth: 12, monthLabel: '10月', bookable: true, ariaLabel: '10月12日 周一' })
    expect(days[30]?.value).toBe('2026-11-11')
    expect(bookableOf('2026-10-12', 7)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
  })

  it('可选天数跟着规则值变：3 天、1 天、0 天；超过 31 天时 31 格全可选', () => {
    expect(bookableOf('2026-10-12', 3)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
    expect(bookableOf('2026-10-12', 1)).toEqual(['2026-10-12'])
    expect(bookableOf('2026-10-12', 0)).toEqual([])
    expect(bookableOf('2026-10-12', 40)).toHaveLength(31)
  })

  it('跨月、跨年：每月 1 日标出月份，日期按 UTC 字段计算', () => {
    const days = calendarDays('2026-12-30', 7)

    expect(days.slice(0, 4).map((day) => [day.value, day.monthLabel])).toEqual([
      ['2026-12-30', '12月'], ['2026-12-31', null], ['2027-01-01', '1月'], ['2027-01-02', null],
    ])
    expect(days[2]?.ariaLabel).toBe('1月1日 周五')
  })
})

describe('calendarWeeks：周一为每周第一天，首尾用空格补齐', () => {
  it('今天是周三：第一行前面空两格，共 5 行、每行 7 格，31 天都在', () => {
    const weeks = calendarWeeks(calendarDays('2026-10-14', 7))

    expect(mondayIndex('2026-10-14')).toBe(2)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]?.slice(0, 3).map((cell) => cell?.value ?? null)).toEqual([null, null, '2026-10-14'])
    expect(weeks.flat().filter((cell) => cell !== null)).toHaveLength(31)
    expect(weeks).toHaveLength(5)
  })

  it('今天是周一：第一行不补空格', () => {
    expect(calendarWeeks(calendarDays('2026-10-12', 7))[0]?.[0]?.value).toBe('2026-10-12')
    expect(calendarWeeks([])).toEqual([])
  })
})

describe('置灰说明与范围文字', () => {
  it('说明里的天数取自 advanceDays', () => {
    expect(bookableHint(7)).toBe('可预约今天起 7 天内（含今天）的日期，其余日期暂不可预约')
    expect(bookableHint(3)).toContain('3 天内')
    expect(bookableHint(0)).toBe('暂时没有可预约的日期')
  })

  it('范围：第一天到第 31 天', () => {
    expect(rangeText(calendarDays('2026-10-12', 7))).toBe('10月12日 – 11月11日')
    expect(rangeText([])).toBe('')
  })
})

describe('nextFocusIndex：月历的键盘移动', () => {
  it('左右 ±1、上下 ±7，到边界停住', () => {
    expect(nextFocusIndex(5, 'ArrowRight', 31, 3)).toBe(6)
    expect(nextFocusIndex(5, 'ArrowLeft', 31, 3)).toBe(4)
    expect(nextFocusIndex(5, 'ArrowDown', 31, 3)).toBe(12)
    expect(nextFocusIndex(5, 'ArrowUp', 31, 3)).toBe(0)
    expect(nextFocusIndex(0, 'ArrowLeft', 31, 0)).toBe(0)
    expect(nextFocusIndex(28, 'ArrowDown', 31, 0)).toBe(30)
  })

  it('Home/End 到本周第一天、最后一天；PageUp/PageDown 到范围首尾；其他键不处理', () => {
    expect(nextFocusIndex(9, 'Home', 31, 3)).toBe(6)
    expect(nextFocusIndex(9, 'End', 31, 3)).toBe(12)
    expect(nextFocusIndex(1, 'Home', 31, 4)).toBe(0)
    expect(nextFocusIndex(9, 'PageUp', 31, 3)).toBe(0)
    expect(nextFocusIndex(9, 'PageDown', 31, 3)).toBe(30)
    expect(nextFocusIndex(9, 'Enter', 31, 3)).toBeNull()
    expect(nextFocusIndex(9, 'a', 31, 3)).toBeNull()
  })
})

describe('场馆图片的静态文件约定', () => {
  it('封面 media/venues/<id>/cover.jpg，标志 media/venues/<id>/logo.png，按部署根路径拼接', () => {
    expect(venueMediaUrl(1, 'cover', '/')).toBe('/media/venues/1/cover.jpg')
    expect(venueMediaUrl(3, 'logo', '/')).toBe('/media/venues/3/logo.png')
    expect(venueMediaUrl(2, 'cover', '/app')).toBe('/app/media/venues/2/cover.jpg')
  })

  it('标志占位取场馆名的第一个字', () => {
    expect(venueInitial('网球馆')).toBe('网')
    expect(venueInitial('  游泳馆')).toBe('游')
    expect(venueInitial('')).toBe('')
  })
})
