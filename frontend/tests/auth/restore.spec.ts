// 启动恢复失败时的登录页提示与网络失败（FE-2 审计 N-2、N-8）。用内存路由 + Pinia + mock ApiClient，不使用真实时间。
import { describe, expect, it } from 'vitest'

import { mapNetworkError } from '../../src/api/http/transport'
import { createAuthHarness, DEMO_PASSWORD, START } from './harness'

const STORAGE_KEY = 'campus-venue.auth'
const FUTURE = '2026-10-12T17:00:00'

describe('N-2 启动恢复：本地过期', () => {
  it('N-2 本地判定已过期：登录页提示“登录已过期，请重新登录”', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.clock.set(FUTURE)
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.notice).toBe('登录已过期，请重新登录')
  })
})

describe('N-2 启动恢复：失败时的登录页提示', () => {
  it('服务端判定过期（本地时钟认为未过期）：getMe 返回 TOKEN_EXPIRED → 提示“登录已过期，请重新登录”并清除', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.clock.set(FUTURE)
    const reloaded = h.reload({ now: () => START })
    await reloaded.auth.restore()

    expect(reloaded.getMeCalls()).toBe(1)
    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.storage.items.size).toBe(0)
    expect(reloaded.auth.notice).toBe('登录已过期，请重新登录')
  })

  it('无效令牌：getMe 返回 AUTH_REQUIRED → 静默清除，没有提示', async () => {
    const h = createAuthHarness()
    h.storage.setItem(STORAGE_KEY, JSON.stringify({ token: 'forged-token', expiresAt: FUTURE }))
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.getMeCalls()).toBe(1)
    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.auth.notice).toBeNull()
  })

  it('storage 里没有任何内容或内容损坏：静默，没有提示', async () => {
    const h = createAuthHarness()
    h.storage.setItem(STORAGE_KEY, 'not-json')
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.notice).toBeNull()
  })
})

describe('N-8 启动恢复：网络失败与过期来源可区分', () => {
  it('getMe 网络失败（ApiError status 0）：清除登录态与 storage，静默无提示', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    const reloaded = h.reload({ getMe: () => Promise.reject(mapNetworkError(new Error('Failed to fetch'))) })
    await reloaded.auth.restore()

    expect(reloaded.getMeCalls()).toBe(1)
    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.auth.token).toBeNull()
    expect(reloaded.tokenSeenByApi()).toBeNull()
    expect(reloaded.storage.items.size).toBe(0)
    expect(reloaded.auth.notice).toBeNull()
  })

  it('本地过期不发请求，服务端过期发出一次请求；两者提示相同但调用次数不同', async () => {
    const local = createAuthHarness()
    await local.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    local.clock.set(FUTURE)
    const byLocal = local.reload()
    await byLocal.auth.restore()

    const remote = createAuthHarness()
    await remote.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    remote.clock.set(FUTURE)
    const byServer = remote.reload({ now: () => START })
    await byServer.auth.restore()

    expect(byLocal.getMeCalls()).toBe(0)
    expect(byServer.getMeCalls()).toBe(1)
    expect(byLocal.auth.notice).toBe(byServer.auth.notice)
    expect(byLocal.storage.items.size).toBe(0)
    expect(byServer.storage.items.size).toBe(0)
  })
})
