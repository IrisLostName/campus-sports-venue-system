// TEST-2 K6（台账 S-059）页面层：Access 会话过期后，用户端页面用真实的 http 适配器（替身 fetch）拿到非 JSON 响应，
// 断言页面显示通用错误与“重试”、不崩溃、不显示任何预约数据；点“重试”会重新发请求。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '../../src/api/http'
import { ERROR_MESSAGES } from '../../src/utils/errorMessages'
import HomeView from '../../src/views/user/HomeView.vue'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { buttonByText, mountWithApp } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

const LOGIN_PAGE = '<!DOCTYPE html><html><head><title>Sign in ・ Cloudflare Access</title></head><body></body></html>'

type Reply = () => Response

const REPLIES: [string, Reply][] = [
  ['200 的 HTML 登录页', () => new Response(LOGIN_PAGE, { status: 200, headers: { 'Content-Type': 'text/html' } })],
  ['302 跳转', () => new Response(null, { status: 302, headers: { Location: 'https://example.cloudflareaccess.com/' } })],
]

async function openWithAccessExpired(view: typeof HomeView, reply: Reply): Promise<{ page: VueWrapper; requests: string[] }> {
  const ctx = await loginAs('zhangsan', '/')
  const requests: string[] = []
  useApiClient(createHttpClient({
    baseUrl: 'https://demo.example', getToken: () => 'token',
    fetchImpl: async (input) => {
      requests.push(String(input))
      return reply()
    },
  }))
  const page = mountWithApp(view, ctx.h)
  await flushPromises()
  return { page, requests }
}

describe('TEST-2 K6 Access 会话过期：用户端页面显示通用错误', () => {
  it.each(REPLIES)('预约页（%s）：通用错误 + 重试，没有卡片；重试会重新请求', async (_label, reply) => {
    const { page, requests } = await openWithAccessExpired(ReservationView, reply)

    expect(page.find('h1').text()).toBe('预约')
    expect(page.find('[role="alert"]').text()).toContain(ERROR_MESSAGES.INTERNAL_ERROR)
    expect(page.text()).not.toContain('Cloudflare')
    expect(page.findAll('article')).toHaveLength(0)
    const before = requests.length
    await buttonByText(page, '重试').trigger('click')
    await flushPromises()
    expect(requests.length).toBeGreaterThan(before)
    expect(page.find('[role="alert"]').text()).toContain(ERROR_MESSAGES.INTERNAL_ERROR)
  })

  it.each(REPLIES)('首页（%s）：通用错误 + 重试，没有预约摘要', async (_label, reply) => {
    const { page } = await openWithAccessExpired(HomeView, reply)

    expect(page.find('[role="alert"]').text()).toContain(ERROR_MESSAGES.INTERNAL_ERROR)
    expect(page.text()).not.toContain('查看预约详情')
    expect(page.text()).not.toContain('Cloudflare')
    expect(buttonByText(page, '重试').exists()).toBe(true)
  })
})
