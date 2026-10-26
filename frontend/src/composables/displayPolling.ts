// 运营大屏的 5 分钟轮询（docs/12 第 5.10 节；FE-7-rulings T1–T4；UI-2a-rulings 第 3 节）。
// 大屏是公开页：不经 callApi / handleAuthFailure，也不读取 auth store。定时器可注入，测试不必真实等待。
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

import type { DisplaySummary } from '../api/typesSection5'
import type { DisplayBoardState } from '../utils/displayModel'
import { describeError, type ErrorText } from '../utils/errorText'

export const POLL_INTERVAL_MS = 300_000
export const COUNTDOWN_TICK_MS = 1_000

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

// 剩余毫秒数显示为 mm:ss（向上取整到秒）。
export function formatCountdown(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`
}

export interface CountdownDeps {
  intervalMs?: number
  scheduler?: DisplayScheduler
  now?: () => number
}

// 下次刷新倒计时（UI-2a）：轮询从进入页面起每 intervalMs 触发一次，所以下次刷新时刻 = 进入时刻 + k × intervalMs，
// 不需要改动轮询本身。与 useDisplayBoard 在同一个 setup 里调用；作用域销毁时停止计时。
export function useRefreshCountdown(deps: CountdownDeps = {}): ShallowRef<string> {
  const intervalMs = deps.intervalMs ?? POLL_INTERVAL_MS
  const scheduler = deps.scheduler ?? realScheduler
  const now = deps.now ?? (() => Date.now())
  const startedAt = now()
  const remaining = () => intervalMs - ((now() - startedAt) % intervalMs)
  const text = shallowRef(formatCountdown(remaining()))
  const timer = scheduler.setInterval(() => {
    text.value = formatCountdown(remaining())
  }, COUNTDOWN_TICK_MS)
  onScopeDispose(() => scheduler.clearInterval(timer))
  return text
}
