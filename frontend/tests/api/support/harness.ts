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
  // 以指定账号登录的独立 mock 客户端（共享同一份 mock 数据、规则与时钟，不改变本实例的登录身份）。
  clientFor(username: string): Promise<ApiClient>
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
    async clientFor(username) {
      let own: string | null = null
      const client = createMockHandle({ clock, state: handle.context.state, rules: handle.context.rules, getToken: () => own }).api
      own = (await client.login({ username, password: DEMO_PASSWORD })).token
      return client
    },
  }
}

// v1.1（P2-1c）起用户不能自行签到：以预约人身份取签到码，再由管理员客户端扫码提交（POST /admin/check-ins）。
// 用于需要“已签到”前置状态的测试，替代原来的 api.checkIn(id)。
export async function checkInByScan(owner: ApiClient, admin: ApiClient, id: number): Promise<void> {
  const { code } = await owner.getCheckInCode(id)
  await admin.adminCheckIn({ code })
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

// 把时钟拨到指定时间戳后重新登录（登录令牌 8 小时过期，跨度大的时间跳转必须重新登录）。
export async function travel(h: Harness, timestamp: string, username: string): Promise<void> {
  h.clock.set(timestamp)
  await h.loginAs(username)
}
