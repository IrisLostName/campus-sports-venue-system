// mock 测试脚手架：固定可推进的时钟 + 按用户名登录的 mock 实例。不使用真实时钟，也不等待。
import { expect } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { ApiError } from '../../../src/api/errors'
import { createMockHandle, type MockHandle } from '../../../src/api/mock/index'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { addMinutes } from '../../../src/api/mock/timeMath'
import type { Clock } from '../../../src/api/mock/clock'
import { ERROR_HTTP_STATUS, type ErrorCode } from '../../../src/api/types'

// 2026-10-12 是星期一；种子数据里的“明天”是 2026-10-13。可预约范围 [10-12, 10-19)。
export const TODAY = '2026-10-12'
export const TOMORROW = '2026-10-13'
export const NOW = `${TODAY}T07:00:00`

export interface FakeClock extends Clock {
  set(timestamp: string): void
  advanceMinutes(minutes: number): void
}

export function createFakeClock(start: string): FakeClock {
  let current = start
  return {
    now: () => current,
    set: (timestamp) => { current = timestamp },
    advanceMinutes: (minutes) => { current = addMinutes(current, minutes) },
  }
}

export interface Harness extends MockHandle {
  clock: FakeClock
  loginAs(username: string): Promise<void>
  logout(): void
}

export function createHarness(start: string = NOW): Harness {
  const clock = createFakeClock(start)
  let token: string | null = null
  const handle = createMockHandle({ clock, getToken: () => token })
  return {
    ...handle,
    clock,
    async loginAs(username) {
      token = (await handle.api.login({ username, password: DEMO_PASSWORD })).token
    },
    logout() {
      token = null
    },
  }
}

// 创建一个预约并返回；调用前需已登录为 USER。
export async function book(api: ApiClient, resourceId: number, serviceDate: string, startTime: string) {
  return api.createReservation({ resourceId, serviceDate, startTime })
}

// 断言 promise 以指定错误码拒绝，并核对 HTTP 状态与 details；返回错误供进一步断言。
export async function expectApiError(
  pending: Promise<unknown>, code: ErrorCode, details?: Record<string, unknown>,
): Promise<ApiError> {
  const error = await pending.then(() => undefined, (cause: unknown) => cause)
  expect(error, `期望 ${code}，但调用成功了`).toBeInstanceOf(ApiError)
  if (!(error instanceof ApiError)) {
    throw new Error('unreachable')
  }
  expect(error.code).toBe(code)
  expect(error.status).toBe(ERROR_HTTP_STATUS[code])
  if (details !== undefined) {
    expect(error.details).toMatchObject(details)
  }
  return error
}

// 移动到某一天的某个时刻（场馆本地时间）。
export function setTime(h: Harness, date: string, time: string): void {
  h.clock.set(`${date}T${time}:00`)
}
