// FE-7 测试脚手架：可手动触发的定时器、可控的拉取替身、手工构造的 DisplaySummary。不使用真实时间。
import type { DisplayScheduler } from '../../src/composables/displayPolling'
import type { DisplaySummary } from '../../src/api/typesSection5'

export interface ManualScheduler extends DisplayScheduler {
  intervals: number[]
  active(): number
  tick(): void
}

export function createManualScheduler(): ManualScheduler {
  const handlers = new Map<number, () => void>()
  const intervals: number[] = []
  let next = 1
  return {
    intervals,
    setInterval(handler, ms) {
      const id = next
      next += 1
      handlers.set(id, handler)
      intervals.push(ms)
      return id
    },
    clearInterval(handle) {
      handlers.delete(handle as number)
    },
    active: () => handlers.size,
    tick() {
      for (const handler of [...handlers.values()]) {
        handler()
      }
    },
  }
}

// 让已完成的 Promise 回调全部执行（不涉及定时器）。
export async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) {
    await Promise.resolve()
  }
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

export function makeSummary(overrides: Partial<DisplaySummary> = {}): DisplaySummary {
  return {
    generatedAt: '2026-10-12T07:00:00',
    todayReservationCount: 3,
    currentInUse: 1,
    todayUtilizationRate: 0.625,
    venues: [
      { venueId: 1, venueName: '网球馆', operationalStatus: 'OPEN', userBookingEnabled: true,
        resourceTotal: 2, resourceOpen: 2, resourcesReservedNow: 1 },
      { venueId: 2, venueName: '羽毛球馆', operationalStatus: 'CLOSED', userBookingEnabled: false,
        resourceTotal: 1, resourceOpen: 0, resourcesReservedNow: 0 },
    ],
    resources: [
      { venueId: 1, resourceId: 1, resourceName: '网球场1', state: 'RESERVED' },
      { venueId: 1, resourceId: 2, resourceName: '网球场2', state: 'FREE' },
      { venueId: 2, resourceId: 3, resourceName: '羽毛球场1', state: 'MAINTENANCE' },
    ],
    weekTrend: [],
    notices: [],
    ...overrides,
  }
}
