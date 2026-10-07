// http.ts 错误映射：ErrorBody 透传、未知错误码、非 JSON 响应、网络失败（规划裁决 A16；docs/12 第 3、7 节）。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { createHttpClient } from '../../../src/api/http'
import { ERROR_CODES, ERROR_HTTP_STATUS } from '../../../src/api/types'
import { ERROR_MESSAGES } from '../../../src/utils/errorMessages'
import { createFetchStub, type StubReply } from '../support/fetchStub'

async function failureOf(reply: StubReply): Promise<ApiError> {
  const stub = createFetchStub(reply)
  const api = createHttpClient({ baseUrl: 'http://localhost:8080', getToken: () => 't', fetchImpl: stub.fetchImpl })
  try {
    await api.getMe()
  } catch (error) {
    if (error instanceof ApiError) {
      return error
    }
    throw error
  }
  throw new Error('期望抛出 ApiError，但请求成功了')
}

describe('http.ts 错误映射：服务端 ErrorBody', () => {
  it('原样保留 status、code、message、details', async () => {
    const error = await failureOf({
      status: 409,
      json: { code: 'BOOKING_LIMIT_REACHED', message: '服务端文案', details: { max: 3 } },
    })
    expect(error.status).toBe(409)
    expect(error.code).toBe('BOOKING_LIMIT_REACHED')
    expect(error.message).toBe('服务端文案')
    expect(error.details).toEqual({ max: 3 })
  })

  it('没有 details 时 details 为 undefined', async () => {
    const error = await failureOf({ status: 401, json: { code: 'AUTH_REQUIRED', message: '请先登录' } })
    expect(error.details).toBeUndefined()
  })

  it('IMPACT_CONFIRMATION_REQUIRED 的 details.impact 原样保留', async () => {
    const impact = { affectedCount: 1, reservations: [{ id: 1 }] }
    const error = await failureOf({
      status: 409,
      json: { code: 'IMPACT_CONFIRMATION_REQUIRED', message: 'm', details: { impact } },
    })
    expect(error.details).toEqual({ impact })
  })

  it('未知错误码原样透传，不改写为其他码', async () => {
    const error = await failureOf({ status: 418, json: { code: 'SOMETHING_NEW', message: 'x' } })
    expect(error.code).toBe('SOMETHING_NEW')
    expect(error.status).toBe(418)
  })

  it('ErrorBody 缺少 message 时使用 INTERNAL_ERROR 文案', async () => {
    const error = await failureOf({ status: 403, json: { code: 'FORBIDDEN' } })
    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })

  it.each(ERROR_CODES)('错误码 %s 按文档状态码透传', async (code) => {
    const status = ERROR_HTTP_STATUS[code]
    const error = await failureOf({ status, json: { code, message: ERROR_MESSAGES[code] } })
    expect([error.status, error.code, error.message]).toEqual([status, code, ERROR_MESSAGES[code]])
  })
})

describe('http.ts 错误映射：没有 ErrorBody 的失败', () => {
  it('非 JSON 响应 → INTERNAL_ERROR，状态取响应状态', async () => {
    const error = await failureOf({ status: 502, text: '<html>Bad Gateway</html>' })
    expect(error.status).toBe(502)
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })

  it('JSON 但没有 code 字段 → INTERNAL_ERROR', async () => {
    const error = await failureOf({ status: 500, json: { error: 'oops' } })
    expect(error.status).toBe(500)
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('空响应体的 4xx → INTERNAL_ERROR，状态取响应状态', async () => {
    const error = await failureOf({ status: 404 })
    expect(error.status).toBe(404)
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('网络失败 → INTERNAL_ERROR，状态 0，原因写入 details.reason', async () => {
    const error = await failureOf({ failure: new TypeError('fetch failed') })
    expect(error.status).toBe(0)
    expect(error.code).toBe('INTERNAL_ERROR')
    expect(error.details).toEqual({ reason: 'fetch failed' })
  })

  it('2xx 但响应体不是合法 JSON → INTERNAL_ERROR，不返回假数据', async () => {
    const error = await failureOf({ status: 200, text: 'not json' })
    expect(error.status).toBe(200)
    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('http 模式失败时抛错，不回退为任何本地数据', async () => {
    const stub = createFetchStub({ failure: new TypeError('connection refused') })
    const api = createHttpClient({ baseUrl: 'http://localhost:8080', getToken: () => null, fetchImpl: stub.fetchImpl })
    await expect(api.listVenues()).rejects.toBeInstanceOf(ApiError)
  })
})
