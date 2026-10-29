// 契约套件的共用部分：被测目标、登录、“今天”与错误码断言（suite.ts 与各分组共用）。
import { expect } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { ApiError } from '../../../src/api/errors'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { addDays, dateOf } from '../../../src/api/mock/timeMath'
import { ERROR_HTTP_STATUS, type ErrorCode } from '../../../src/api/types'

export interface ContractTarget {
  api: ApiClient
  setToken(token: string | null): void     // 切换当前登录身份（http 实现由 auth store 提供 Token）
}

export async function loginAs(target: ContractTarget, username: string): Promise<void> {
  target.setToken(null)
  target.setToken((await target.api.login({ username, password: DEMO_PASSWORD })).token)
}

// 被测实现眼中的“今天”与“明天”（BE-8 K1）。明天总在可预约范围 [今天, 今天 + advanceDays) 内，且不受当天时刻影响。
export async function serverDates(target: ContractTarget): Promise<{ today: string; tomorrow: string }> {
  const today = dateOf((await target.api.getDisplaySummary()).generatedAt)
  return { today, tomorrow: addDays(today, 1) }
}

export async function expectCode(pending: Promise<unknown>, code: ErrorCode): Promise<ApiError> {
  const error = await pending.then(() => undefined, (cause: unknown) => cause)
  expect(error, `期望 ${code}`).toBeInstanceOf(ApiError)
  const apiError = error as ApiError
  expect([apiError.code, apiError.status]).toEqual([code, ERROR_HTTP_STATUS[code]])
  return apiError
}
