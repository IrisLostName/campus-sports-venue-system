// TEST-2 K6（BE-8 N9、O-1；台账 S-059）：演示站点前的 Cloudflare Access 会话过期时，接口请求拿到的不是后端的 JSON。
// 本机无法复现 Access，这里用替身 fetch 模拟三种情形，断言 http 适配器一律抛 INTERNAL_ERROR 与通用文案、不返回任何数据：
//   1) 浏览器跟随跳转后拿到 200 的 HTML 登录页；2) 302 跳转本身（不跟随时）；3) 跨源跳转被 CORS 拦下，fetch 抛 TypeError。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { ApiError } from '../../../src/api/errors'
import { createHttpClient } from '../../../src/api/http'
import { ERROR_MESSAGES } from '../../../src/utils/errorMessages'

const ACCESS_LOGIN = 'https://example.cloudflareaccess.com/cdn-cgi/access/login/demo.example?redirect_url=%2Fapi%2Fv1%2Fme'
const LOGIN_PAGE = '<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head>'
  + '<body><form action="/cdn-cgi/access/login"><button>Send me a code</button></form></body></html>'

type Scenario = [string, () => Promise<Response>, number]

const SCENARIOS: Scenario[] = [
  ['200 的 HTML 登录页（已跟随跳转）', async () => new Response(LOGIN_PAGE, {
    status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }), 200],
  ['302 跳转到 Access 登录（未跟随）', async () => new Response(null, { status: 302, headers: { Location: ACCESS_LOGIN } }), 302],
  ['跨源跳转被 CORS 拦下：fetch 抛 TypeError', async () => {
    throw new TypeError('Failed to fetch')
  }, 0],
]

function clientWith(reply: () => Promise<Response>): ApiClient {
  return createHttpClient({ baseUrl: 'https://demo.example', getToken: () => 'token', fetchImpl: () => reply() })
}

async function failureOf(call: Promise<unknown>): Promise<ApiError> {
  const outcome = await call.then((value) => ({ value }), (error: unknown) => ({ error }))
  if (!('error' in outcome)) {
    throw new Error(`期望抛出 ApiError，却得到数据：${JSON.stringify(outcome.value)}`)
  }
  expect(outcome.error).toBeInstanceOf(ApiError)
  return outcome.error as ApiError
}

describe('TEST-2 K6 Access 会话过期：http 适配器得到通用错误', () => {
  it.each(SCENARIOS)('%s → INTERNAL_ERROR 与通用文案', async (_label, reply, status) => {
    const api = clientWith(reply)
    const calls: Promise<unknown>[] = [
      api.getMe(), api.listMyReservations({ scope: 'CURRENT' }), api.getBookingRules(), api.getDisplaySummary(),
    ]
    for (const call of calls) {
      const error = await failureOf(call)
      expect([error.status, error.code, error.message]).toEqual([status, 'INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR])
    }
  })

  it('HTML 登录页的内容不会出现在错误文案或 details 里', async () => {
    const error = await failureOf(clientWith(SCENARIOS[0][1]).getMe())

    expect(error.message).not.toContain('Cloudflare')
    expect(JSON.stringify(error.details ?? null)).not.toContain('Cloudflare')
  })

  it('写操作同样失败，不当作成功', async () => {
    const api = clientWith(SCENARIOS[0][1])
    const error = await failureOf(api.createReservation({ resourceId: 1, serviceDate: '2026-10-21', startTime: '08:00' }))

    expect(error.code).toBe('INTERNAL_ERROR')
  })
})
