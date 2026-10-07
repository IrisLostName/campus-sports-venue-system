// 运营大屏的 30 秒轮询（docs/12 第 5.10 节；FE-7-rulings T1–T4）。
// 大屏是公开页：不经 callApi / handleAuthFailure，也不读取 auth store。定时器可注入，测试不必真实等待。
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

import type { DisplaySummary } from '../api/typesSection5'
import type { DisplayBoardState } from '../utils/displayModel'
import { describeError, type ErrorText } from '../utils/errorText'

export const POLL_INTERVAL_MS = 30_000

export interface DisplayScheduler {
  setInterval(handler: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

export const realScheduler: DisplayScheduler = {
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export interface DisplayPollerDeps {
  fetchSummary: () => Promise<DisplaySummary>
  scheduler?: DisplayScheduler
  intervalMs?: number
}

export interface DisplayPoller {
  state: ShallowRef<DisplayBoardState>
  start(): void
  stop(): void
}

// 有旧数据时保留旧数据并附上失败原因；没有数据时进入错误状态。
function failedState(previous: DisplayBoardState, failure: ErrorText): DisplayBoardState {
  return previous.phase === 'ready'
    ? { phase: 'ready', summary: previous.summary, failure }
    : { phase: 'error', failure }
}

export function createDisplayPoller(deps: DisplayPollerDeps): DisplayPoller {
  const scheduler = deps.scheduler ?? realScheduler
  const intervalMs = deps.intervalMs ?? POLL_INTERVAL_MS
  const state = shallowRef<DisplayBoardState>({ phase: 'loading' })
  let timer: unknown = null
  let running = false
  let inFlight = false

  async function refresh(): Promise<void> {
    if (inFlight) {
      return
    }
    inFlight = true
    try {
      const summary = await deps.fetchSummary()
      if (running) {
        state.value = { phase: 'ready', summary, failure: null }
      }
    } catch (error) {
      if (running) {
        state.value = failedState(state.value, describeError(error))
      }
    } finally {
      inFlight = false
    }
  }

  function start(): void {
    if (running) {
      return
    }
    running = true
    void refresh()
    timer = scheduler.setInterval(() => void refresh(), intervalMs)
  }

  function stop(): void {
    running = false
    if (timer !== null) {
      scheduler.clearInterval(timer)
      timer = null
    }
  }

  return { state, start, stop }
}

// 在组件 setup（或 effectScope）里调用：立即拉取一次并开始轮询，组件卸载（作用域销毁）时停止。
export function useDisplayBoard(deps: DisplayPollerDeps): ShallowRef<DisplayBoardState> {
  const poller = createDisplayPoller(deps)
  poller.start()
  onScopeDispose(poller.stop)
  return poller.state
}
