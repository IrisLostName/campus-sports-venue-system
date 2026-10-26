// UI-2a-rulings 第 3 节：大屏每 5 分钟拉取一次；顶栏显示下次刷新的倒计时（mm:ss）。定时器与时钟都注入，不真实等待。
import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  COUNTDOWN_TICK_MS, formatCountdown, POLL_INTERVAL_MS, useDisplayBoard, useRefreshCountdown,
} from '../../src/composables/displayPolling'
import { createManualScheduler, makeSummary, settle } from './support'

describe('轮询间隔 5 分钟', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('POLL_INTERVAL_MS 为 300 000 毫秒，注入的定时器按它注册', async () => {
    const scheduler = createManualScheduler()
    effectScope().run(() => useDisplayBoard({ fetchSummary: () => Promise.resolve(makeSummary()), scheduler }))
    await settle()
    expect(POLL_INTERVAL_MS).toBe(5 * 60 * 1000)
    expect(scheduler.intervals).toEqual([300_000])
  })

  it('真实定时器（假时钟）：4 分 59 秒时还没有第二次拉取，5 分钟整时拉取', async () => {
    vi.useFakeTimers()
    const fetchSummary = vi.fn(() => Promise.resolve(makeSummary()))
    const scope = effectScope()
    scope.run(() => useDisplayBoard({ fetchSummary }))
    await vi.advanceTimersByTimeAsync(299_000)
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchSummary).toHaveBeenCalledTimes(2)
    scope.stop()
  })
})

describe('下次刷新倒计时', () => {
  it('mm:ss 格式，向上取整到秒', () => {
    expect(formatCountdown(300_000)).toBe('05:00')
    expect(formatCountdown(299_001)).toBe('05:00')
    expect(formatCountdown(299_000)).toBe('04:59')
    expect(formatCountdown(61_000)).toBe('01:01')
    expect(formatCountdown(500)).toBe('00:01')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-5)).toBe('00:00')
  })

  it('从进入页面起倒数，到点后回到 05:00（与轮询同一节拍）；每秒更新；卸载后停止计时', () => {
    const scheduler = createManualScheduler()
    let now = 1_000_000
    const scope = effectScope()
    const text = scope.run(() => useRefreshCountdown({ scheduler, now: () => now }))
    if (text === undefined) {
      throw new Error('effectScope 没有运行')
    }
    expect(text.value).toBe('05:00')
    expect(scheduler.intervals).toEqual([COUNTDOWN_TICK_MS])

    const at = (elapsed: number) => {
      now = 1_000_000 + elapsed
      scheduler.tick()
      return text.value
    }
    expect(at(1_000)).toBe('04:59')
    expect(at(60_000)).toBe('04:00')
    expect(at(299_000)).toBe('00:01')
    expect(at(300_000)).toBe('05:00')
    expect(at(301_000)).toBe('04:59')

    scope.stop()
    expect(scheduler.active()).toBe(0)
  })
})
