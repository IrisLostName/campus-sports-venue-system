// stores/auth：登录、注册、登出、启动恢复、令牌提供者（docs/12 第 5.1 节）。
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { selectApi } from '../../src/api/index'
import { defineAuthStore } from '../../src/stores/auth'
import { createFakeClock, expectApiError } from '../api/support/harness'
import { createFetchStub } from '../api/support/fetchStub'
import { createAuthHarness, DEMO_PASSWORD, MemoryStorage, START } from './harness'

const STORAGE_KEY = 'campus-venue.auth'
const FUTURE = '2026-10-12T17:00:00'

const DEMO_ACCOUNTS = [
  { username: 'zhangsan', role: 'USER' },
  { username: 'admin_tennis', role: 'VENUE_ADMIN' },
  { username: 'sysadmin', role: 'SYS_ADMIN' },
] as const

describe('登录', () => {
  it.each(DEMO_ACCOUNTS)('$username 登录成功：保存令牌、过期时间、用户资料，并写入 storage', async ({ username, role }) => {
    const h = createAuthHarness()
    const result = await h.auth.login({ username, password: DEMO_PASSWORD })

    expect(result).toMatchObject({ ok: true, user: { username, role } })
    expect(h.auth.user).toMatchObject({ username, role })
    expect(h.auth.role).toBe(role)
    expect(h.auth.isAuthenticated).toBe(true)
    expect(h.auth.expiresAt).toBe(FUTURE)
    expect(JSON.parse(h.storage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      token: h.auth.token, expiresAt: FUTURE,
    })
  })

  it('登录后 API 层经令牌提供者拿到同一个令牌，受保护接口可用', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })

    expect(h.tokenSeenByApi()).toBe(h.auth.token)
    expect((await h.api.getMe()).username).toBe('zhangsan')
  })

  it('密码错误 → INVALID_CREDENTIALS 与对应中文文案，不改变登录状态', async () => {
    const h = createAuthHarness()
    const result = await h.auth.login({ username: 'zhangsan', password: 'wrong-password' })

    expect(result).toEqual({ ok: false, code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' })
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.auth.token).toBeNull()
    expect(h.storage.items.size).toBe(0)
  })

  it('账号已停用 → ACCOUNT_DISABLED 与对应中文文案', async () => {
    const h = createAuthHarness()
    await h.disableAccount('lisi')
    const result = await h.auth.login({ username: 'lisi', password: DEMO_PASSWORD })

    expect(result).toEqual({ ok: false, code: 'ACCOUNT_DISABLED', message: '账号已停用' })
    expect(h.auth.isAuthenticated).toBe(false)
  })
})

describe('注册', () => {
  const NEWCOMER = { username: 'newcomer', password: 'Passw0rd!', displayName: '新同学' }

  it('成功：以 USER 身份登录，状态与登录一致', async () => {
    const h = createAuthHarness()
    const result = await h.auth.register(NEWCOMER)

    expect(result).toMatchObject({ ok: true, user: { username: 'newcomer', role: 'USER' } })
    expect(h.auth.role).toBe('USER')
    expect(h.tokenSeenByApi()).toBe(h.auth.token)
    expect(h.storage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('用户名已被占用 → USERNAME_TAKEN 与对应中文文案', async () => {
    const h = createAuthHarness()
    const result = await h.auth.register({ ...NEWCOMER, username: 'zhangsan' })

    expect(result).toEqual({ ok: false, code: 'USERNAME_TAKEN', message: '用户名已被占用' })
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('参数不合法 → VALIDATION_ERROR 与对应中文文案', async () => {
    const h = createAuthHarness()
    const result = await h.auth.register({ ...NEWCOMER, username: 'ab' })

    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR', message: '请求参数不合法' })
    expect(h.auth.isAuthenticated).toBe(false)
  })
})

describe('登出', () => {
  it('清除令牌与用户，清空 storage；API 层此后读不到令牌，受保护接口返回 AUTH_REQUIRED', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.auth.logout()

    expect(h.auth.token).toBeNull()
    expect(h.auth.expiresAt).toBeNull()
    expect(h.auth.user).toBeNull()
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.storage.items.size).toBe(0)
    expect(h.tokenSeenByApi()).toBeNull()
    await expectApiError(h.api.getMe(), 'AUTH_REQUIRED')
  })

  it('登出后刷新页面不会恢复登录', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.auth.logout()
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(false)
  })
})

describe('启动恢复', () => {
  it('令牌有效：恢复登录，用户资料来自 getMe，令牌交给 API 层', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'admin_pool', password: DEMO_PASSWORD })
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(true)
    expect(reloaded.auth.user).toMatchObject({ username: 'admin_pool', role: 'VENUE_ADMIN', venueIds: [2, 3] })
    expect(reloaded.auth.token).toBe(h.auth.token)
    expect(reloaded.tokenSeenByApi()).toBe(h.auth.token)
    expect(reloaded.storage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(reloaded.getMeCalls()).toBe(1)
  })

  it('已过期：清除令牌与 storage，且不发出 getMe 请求', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.clock.set(FUTURE)       // 恰为过期时刻：视为已过期
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.auth.token).toBeNull()
    expect(reloaded.tokenSeenByApi()).toBeNull()
    expect(reloaded.storage.items.size).toBe(0)
    expect(reloaded.getMeCalls()).toBe(0)
  })

  it('过期前一秒仍然有效', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.clock.set('2026-10-12T16:59:59')
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(true)
  })

})

describe('启动恢复：getMe 校验失败', () => {
  it('getMe 失败（令牌未过期但服务端不认）：清除令牌与 storage', async () => {
    const h = createAuthHarness()
    h.storage.setItem(STORAGE_KEY, JSON.stringify({ token: 'forged-token', expiresAt: FUTURE }))
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.auth.token).toBeNull()
    expect(reloaded.tokenSeenByApi()).toBeNull()
    expect(reloaded.storage.items.size).toBe(0)
  })

  it('getMe 返回 ACCOUNT_DISABLED：清除登录状态，并留下“账号已停用”提示', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    await h.disableAccount('zhangsan')
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.storage.items.size).toBe(0)
    expect(reloaded.auth.notice).toBe('账号已停用')
  })

})

describe('启动恢复：storage 内容异常', () => {
  it.each([
    ['不是 JSON', 'not-json'],
    ['缺少令牌', JSON.stringify({ expiresAt: FUTURE })],
    ['过期时间格式不对', JSON.stringify({ token: 'x', expiresAt: 'tomorrow' })],
  ])('storage 内容损坏（%s）：清除并视为未登录', async (_label, raw) => {
    const h = createAuthHarness()
    h.storage.setItem(STORAGE_KEY, raw)
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(reloaded.auth.isAuthenticated).toBe(false)
    expect(reloaded.storage.items.size).toBe(0)
  })

  it('storage 里没有任何内容：未登录', async () => {
    const h = createAuthHarness()
    await h.auth.restore()
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('restore 只执行一次：并发调用都等到恢复完成，之后再调用不会重新读取 storage', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    const reloaded = h.reload()
    await Promise.all([reloaded.auth.restore(), reloaded.auth.restore()])
    expect(reloaded.auth.isAuthenticated).toBe(true)

    reloaded.storage.setItem(STORAGE_KEY, 'not-json')
    await reloaded.auth.restore()
    expect(reloaded.auth.isAuthenticated).toBe(true)
  })
})

describe('ACC-M2-11 模式切换：同一个 auth store 代码在 mock 与 http 两种 ApiClient 下行为一致', () => {
  const PROFILE = {
    id: 1, username: 'zhangsan', displayName: '张三', role: 'USER', userType: 'STUDENT',
    phone: null, status: 'ACTIVE', venueIds: null,
  }

  function httpFetchStub(issuedToken: string) {
    return createFetchStub((call) => {
      if (call.url.endsWith('/auth/login')) {
        return { status: 200, json: { token: issuedToken, expiresAt: FUTURE, user: PROFILE } }
      }
      const authorized = call.headers.Authorization === `Bearer ${issuedToken}`
      return authorized
        ? { status: 200, json: PROFILE }
        : { status: 401, json: { code: 'AUTH_REQUIRED', message: '请先登录' } }
    })
  }

  it.each(['mock', 'http'] as const)('%s：登录 → 用令牌调用 getMe → 登出后失去令牌', async (mode) => {
    let provider: () => string | null = () => null
    const stub = httpFetchStub('http-token')
    const api = selectApi(mode, {
      getToken: () => provider(), baseUrl: 'http://localhost:8080',
      fetchImpl: stub.fetchImpl, clock: createFakeClock(START),
    })
    const auth = defineAuthStore({
      api, storage: new MemoryStorage(), now: () => START, setTokenProvider: (next) => { provider = next },
    })(createPinia())

    const result = await auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    expect(result).toMatchObject({ ok: true, user: { username: 'zhangsan', role: 'USER' } })
    expect((await api.getMe()).username).toBe('zhangsan')

    auth.logout()
    expect(provider()).toBeNull()
    await expectApiError(api.getMe(), 'AUTH_REQUIRED')
  })

  it('http：登录请求不带令牌，登录后的请求带 Authorization: Bearer', async () => {
    let provider: () => string | null = () => null
    const stub = httpFetchStub('http-token')
    const api = selectApi('http', { getToken: () => provider(), baseUrl: 'http://localhost:8080', fetchImpl: stub.fetchImpl })
    const auth = defineAuthStore({
      api, storage: new MemoryStorage(), now: () => START, setTokenProvider: (next) => { provider = next },
    })(createPinia())

    await auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    await api.getMe()

    expect(stub.calls[0]?.headers.Authorization).toBeUndefined()
    expect(stub.calls[1]?.headers.Authorization).toBe('Bearer http-token')
  })
})
