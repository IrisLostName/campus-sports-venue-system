// 时钟与时间运算：输出与浏览器时区无关的 Asia/Shanghai 本地时间戳（docs/12 第 1 节；规划修订 3）。
import { describe, expect, it } from 'vitest'

import { formatShanghai, systemClock } from '../../../src/api/mock/clock'
import {
  addDays, addMinutes, dateOf, endTimeOf, fromMinutes, isValidDate, isValidTime, isWithinAdvance, timeOf, toMinutes, weekdayOf,
} from '../../../src/api/mock/timeMath'

describe('formatShanghai：固定 Date → 不带时区偏移的 UTC+8 本地时间', () => {
  it.each([
    ['2026-10-12T00:00:00Z', '2026-10-12T08:00:00'],
    ['2026-10-12T15:59:59Z', '2026-10-12T23:59:59'],
    ['2026-10-12T16:00:00Z', '2026-10-13T00:00:00'],
    ['2026-12-31T16:30:05Z', '2027-01-01T00:30:05'],
    ['2028-02-28T16:00:00Z', '2028-02-29T00:00:00'],
  ])('%s → %s', (utc, expected) => {
    expect(formatShanghai(new Date(utc))).toBe(expected)
  })

  it('格式为 YYYY-MM-DDTHH:mm:ss，没有 Z 或 +08:00', () => {
    expect(systemClock.now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })
})

describe('日期与时刻校验', () => {
  it.each(['2026-10-12', '2028-02-29', '2026-12-31'])('%s 是合法日期', (value) => {
    expect(isValidDate(value)).toBe(true)
  })

  it.each(['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-1', '20261012', '', 'abc'])('%s 不是合法日期', (value) => {
    expect(isValidDate(value)).toBe(false)
  })

  it.each(['00:00', '08:30', '23:59'])('%s 是合法时刻', (value) => {
    expect(isValidTime(value)).toBe(true)
  })

  it.each(['24:00', '8:00', '08:60', '08:00:00', ''])('%s 不是合法时刻', (value) => {
    expect(isValidTime(value)).toBe(false)
  })
})

describe('日期、星期与分钟运算', () => {
  it('星期：周一 = 1 … 周日 = 7', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => weekdayOf(`2026-10-${11 + n}`))).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('addDays 跨月、跨年、闰年', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-10-12', -6)).toBe('2026-10-06')
  })

  it('addMinutes 跨零点', () => {
    expect(addMinutes('2026-10-12T23:30:00', 45)).toBe('2026-10-13T00:15:00')
    expect(addMinutes('2026-10-13T00:10:00', -15)).toBe('2026-10-12T23:55:00')
  })

  it('分钟与时刻互转；90 分钟换算结束时刻', () => {
    expect(toMinutes('08:30')).toBe(510)
    expect(fromMinutes(510)).toBe('08:30')
    expect(endTimeOf('18:30')).toBe('20:00')
    expect(dateOf('2026-10-12T07:45:30')).toBe('2026-10-12')
    expect(timeOf('2026-10-12T07:45:30')).toBe('07:45')
  })

  it('可预约范围 [今天, 今天 + advanceDays)', () => {
    expect(isWithinAdvance('2026-10-12', 7, '2026-10-12')).toBe(true)
    expect(isWithinAdvance('2026-10-12', 7, '2026-10-18')).toBe(true)
    expect(isWithinAdvance('2026-10-12', 7, '2026-10-19')).toBe(false)
    expect(isWithinAdvance('2026-10-12', 7, '2026-10-11')).toBe(false)
  })
})
