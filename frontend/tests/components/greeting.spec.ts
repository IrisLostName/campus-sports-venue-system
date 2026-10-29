// UI-4 裁决第 1 节第 1 条：首页问候语按 Asia/Shanghai 的钟点分四段，边界 11:00、13:00、18:00；姓名接在全角逗号后。
import { afterEach, describe, expect, it, vi } from 'vitest'

import { greetingFor, greetingLine, WELCOME_LINE } from '../../src/utils/greeting'
import { nowShanghai } from '../../src/utils/shanghaiTime'

const DAY = '2026-10-28'

describe('greetingFor：四个时段与边界', () => {
  it.each([
    ['00:00:00', '上午好'],
    ['10:59:59', '上午好'],
    ['11:00:00', '中午好'],
    ['12:59:59', '中午好'],
    ['13:00:00', '下午好'],
    ['17:59:59', '下午好'],
    ['18:00:00', '晚上好'],
    ['23:59:59', '晚上好'],
  ])('%s → %s', (time, expected) => {
    expect(greetingFor(`${DAY}T${time}`)).toBe(expected)
  })
})

describe('greetingLine：问候语 + 显示姓名', () => {
  it('有姓名：“问候语，姓名”', () => {
    expect(greetingLine(`${DAY}T16:00:00`, '张三')).toBe('下午好，张三')
  })

  it('没有姓名：只有问候语', () => {
    expect(greetingLine(`${DAY}T09:00:00`, null)).toBe('上午好')
    expect(greetingLine(`${DAY}T09:00:00`, undefined)).toBe('上午好')
    expect(greetingLine(`${DAY}T09:00:00`, '')).toBe('上午好')
  })

  it('欢迎语', () => {
    expect(WELCOME_LINE).toBe('欢迎使用校园场馆预约与服务管理系统')
  })
})

describe('按业务时区计时，与浏览器所在时区无关', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['2026-10-28T02:59:00Z', '上午好'],   // 上海 10:59
    ['2026-10-28T03:00:00Z', '中午好'],   // 上海 11:00
    ['2026-10-28T04:59:00Z', '中午好'],   // 上海 12:59
    ['2026-10-28T05:00:00Z', '下午好'],   // 上海 13:00
    ['2026-10-28T09:59:00Z', '下午好'],   // 上海 17:59
    ['2026-10-28T10:00:00Z', '晚上好'],   // 上海 18:00
    ['2026-10-27T16:30:00Z', '上午好'],   // 上海次日 00:30
  ])('%s → %s', (instant, expected) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(instant))
    expect(greetingFor(nowShanghai())).toBe(expected)
  })
})
