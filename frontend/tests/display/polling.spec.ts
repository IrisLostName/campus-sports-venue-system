// 大屏 5 分钟轮询（FE-7-rulings T1、T2；UI-2a-rulings 第 3 节）：定时器注入，不真实等待。
import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DisplaySummary } from '../../src/api/typesSection5'
import { POLL_INTERVAL_MS, useDisplayBoard } from '../../src/composables/displayPolling'
import { createManualScheduler, deferred, makeSummary, settle } from './support'

function start(fetchSummary: () => Promise<DisplaySummary>) {
  const scheduler = createManualScheduler()
  const scope = effectScope()
  const state = scope.run(() => useDisplayBoard({ fetchSummary, scheduler }))
  if (state === undefined) {
    throw new Error('effectScope 没有运行')
  }
  return { scheduler, scope, state }
}

function sequence(...stamps: string[]) {
  const calls = { count: 0 }
  const fetchSummary = () => {
    const stamp = stamps[Math.min(calls.count, stamps.length - 1)] ?? ''
    calls.count += 1
    return Promise.resolve(makeSummary({ generatedAt: stamp }))
  }
  return { calls, fetchSummary }
}

describe('进入页面与周期', () => {
  it('进入页面立即拉取一次，随后按 5 分钟周期注册定时器', async () => {
    const { calls, fetchSummary } = sequence('2026-10-12T07:00:00')
    const { scheduler, state } = start(fetchSummary)
    expect(calls.count).toBe(1)
    expect(state.value.phase).toBe('loading')
    await settle()
    expect(state.value).toMatchObject({ phase: 'ready', failure: null })
    expect(scheduler.intervals).toEqual([POLL_INTERVAL_MS])
    expect(POLL_INTERVAL_MS).toBe(300_000)
  })

  it('每次定时触发再拉取一次，并用最新数据替换旧数据', async () => {
    const { calls, fetchSummary } = sequence('2026-10-12T07:00:00', '2026-10-12T07:00:30')
    const { scheduler, state } = start(fetchSummary)
    await settle()
    scheduler.tick()
    await settle()
    expect(calls.count).toBe(2)
    expect(state.value).toMatchObject({ phase: 'ready', summary: { generatedAt: '2026-10-12T07:00:30' } })
  })

  it('卸载后停止：定时器被清除，之后不再拉取，迟到的响应也不再更新', async () => {
    const pending = deferred<DisplaySummary>()
    let count = 0
    const { scheduler, scope, state } = start(() => {
      count += 1
      return count === 1 ? Promise.resolve(makeSummary()) : pending.promise
    })
    await settle()
    scheduler.tick()
    expect(count).toBe(2)
    scope.stop()
    expect(scheduler.active()).toBe(0)
    scheduler.tick()
    pending.resolve(makeSummary({ generatedAt: '2026-10-12T09:00:00' }))
    await settle()
    expect(count).toBe(2)
    expect(state.value).toMatchObject({ summary: { generatedAt: '2026-10-12T07:00:00' } })
  })
})

describe('不叠加请求', () => {
  it('上一次未返回时，到点触发不再发起新请求；返回之后的下一次才继续', async () => {
    const first = deferred<DisplaySummary>()
    let count = 0
    const { scheduler } = start(() => {
      count += 1
      return count === 1 ? first.promise : Promise.resolve(makeSummary())
    })
    scheduler.tick()
    scheduler.tick()
    scheduler.tick()
    expect(count).toBe(1)
    first.resolve(makeSummary())
    await settle()
    scheduler.tick()
    expect(count).toBe(2)
  })

  it('上一次失败返回后同样可以继续下一次', async () => {
    const first = deferred<DisplaySummary>()
    let count = 0
    const { scheduler } = start(() => {
      count += 1
      return count === 1 ? first.promise : Promise.resolve(makeSummary())
    })
    scheduler.tick()
    expect(count).toBe(1)
    first.reject(new Error('断网'))
    await settle()
    scheduler.tick()
    expect(count).toBe(2)
  })
})

describe('默认定时器（vitest 假定时器）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('不注入定时器时 5 分钟触发一次；卸载后不再触发', async () => {
    vi.useFakeTimers()
    const fetchSummary = vi.fn(() => Promise.resolve(makeSummary()))
    const scope = effectScope()
    scope.run(() => useDisplayBoard({ fetchSummary }))
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1)
    expect(fetchSummary).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchSummary).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(fetchSummary).toHaveBeenCalledTimes(3)
    scope.stop()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    expect(fetchSummary).toHaveBeenCalledTimes(3)
  })
})
