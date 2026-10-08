// 大屏组件测试的脚手架：挂载 DisplayView，api 换成按顺序给出结果的记录客户端；只替换 setInterval，不使用真实等待。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, vi } from 'vitest'

import type { DisplaySummary } from '../../src/api/typesSection5'
import { POLL_INTERVAL_MS } from '../../src/composables/displayPolling'
import DisplayView from '../../src/views/display/DisplayView.vue'
import { createHarness } from '../api/support/harness'
import { makeSummary } from '../display/support'
import { recordCalls, useApiClient } from './apiSwap'

// 'pending' 表示这次拉取一直不返回（用来看加载中的状态）。
export type Outcome = DisplaySummary | Error | 'pending'

// 在测试文件顶层调用：每个用例前换成假的 setInterval，用例后恢复。
export function installIntervalClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })
}

export interface MountedDisplay {
  page: VueWrapper
  // 记录到的 ApiClient 方法调用，按发生顺序。
  calls: string[]
  // 走过一个轮询周期并等待渲染完成。
  nextPoll(): Promise<void>
}

// outcomes 依次对应第 1、2、3… 次拉取，用完后重复最后一个。大屏是公开页，所以先登出（不带令牌）。
export async function mountDisplay(outcomes: Outcome[]): Promise<MountedDisplay> {
  const h = createHarness()
  h.logout()
  let count = 0
  const getDisplaySummary = (): Promise<DisplaySummary> => {
    const outcome = outcomes[Math.min(count, outcomes.length - 1)]
    count += 1
    if (outcome === 'pending') {
      return new Promise<DisplaySummary>(() => undefined)
    }
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome ?? makeSummary())
  }
  const { client, calls } = recordCalls({ ...h.api, getDisplaySummary })
  useApiClient(client)
  const page = mount(DisplayView)
  await flushPromises()
  return {
    page,
    calls,
    async nextPoll() {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      await flushPromises()
    },
  }
}
