// stores/reference：只放 BookingRules，加载一次并缓存（FE-3 规划裁决 R1）；调用经 callApi（N-1）。
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { defineReferenceStore } from '../../src/stores/reference'
import { loginAs } from './harness'

function countingApi(base: ApiClient, behaviour: () => Promise<ReturnType<ApiClient['getBookingRules']> extends Promise<infer R> ? R : never>) {
  const state = { calls: 0 }
  const api: ApiClient = { ...base, getBookingRules: () => { state.calls += 1; return behaviour() } }
  return { api, state }
}

describe('stores/reference BookingRules', () => {
  it('第一次加载取接口，之后命中缓存不再请求', async () => {
    const { h, call } = await loginAs('zhangsan', '/')
    const { api, state } = countingApi(h.api, () => h.api.getBookingRules())
    const store = defineReferenceStore({ api })(createPinia())

    expect(store.bookingRules).toBeNull()
    const first = await store.loadBookingRules(call)
    const second = await store.loadBookingRules(call)

    expect(first.ok && first.value.cancelDeadlineMinutes).toBe(120)
    expect(second).toEqual(first)
    expect(store.bookingRules).toMatchObject({ cancelDeadlineMinutes: 120, checkOutGraceMinutes: 30 })
    expect(state.calls).toBe(1)
  })

  it('同时进入两个页面：并发加载共用同一个请求', async () => {
    const { h, call } = await loginAs('zhangsan', '/')
    const { api, state } = countingApi(h.api, () => h.api.getBookingRules())
    const store = defineReferenceStore({ api })(createPinia())

    await Promise.all([store.loadBookingRules(call), store.loadBookingRules(call)])

    expect(state.calls).toBe(1)
  })

  it('失败不缓存，下次可重试', async () => {
    const { h, call } = await loginAs('zhangsan', '/')
    let fail = true
    const { api, state } = countingApi(h.api, () => (fail ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : h.api.getBookingRules()))
    const store = defineReferenceStore({ api })(createPinia())

    const failed = await store.loadBookingRules(call)
    expect(failed).toEqual({ ok: false, code: 'INTERNAL_ERROR', message: '服务器开小差了，请稍后再试', sessionEnded: false })
    expect(store.bookingRules).toBeNull()

    fail = false
    const retried = await store.loadBookingRules(call)
    expect(retried.ok).toBe(true)
    expect(state.calls).toBe(2)
  })

  it('N-1：遇到 TOKEN_EXPIRED 经 callApi 回到登录页', async () => {
    const { h, call } = await loginAs('zhangsan', '/reservation')
    const { api } = countingApi(h.api, () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')))
    const store = defineReferenceStore({ api })(createPinia())

    const result = await store.loadBookingRules(call)

    expect(result).toMatchObject({ ok: false, code: 'TOKEN_EXPIRED', sessionEnded: true })
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.router.currentRoute.value.query.redirect).toBe('/reservation')
  })
})
