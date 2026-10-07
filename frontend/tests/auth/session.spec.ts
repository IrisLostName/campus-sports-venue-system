// 登录状态失效与登出（docs/12 第 7 节）：TOKEN_EXPIRED / AUTH_REQUIRED / ACCOUNT_DISABLED 的统一处理。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { callApi, handleAuthFailure, logoutToLogin, type SessionDeps } from '../../src/composables/session'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from './harness'

const EIGHT_HOURS_AND_ONE_MINUTE = 8 * 60 + 1

async function loggedIn(username: string, startPath: string): Promise<{ h: AuthHarness; deps: SessionDeps }> {
  const h = createAuthHarness()
  await h.auth.login({ username, password: DEMO_PASSWORD })
  await h.router.push(startPath)
  return { h, deps: { auth: h.auth, router: h.router } }
}

describe('TOKEN_EXPIRED：登录已过期', () => {
  it('清除登录状态，回到 /login 并带返回地址，登录页提示“登录已过期，请重新登录”', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/booking')
    h.clock.advanceMinutes(EIGHT_HOURS_AND_ONE_MINUTE)

    const result = await callApi(() => h.api.listMyReservations(), deps)

    expect(result).toEqual({ ok: false, code: 'TOKEN_EXPIRED', message: '登录已过期，请重新登录', sessionEnded: true })
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.auth.token).toBeNull()
    expect(h.storage.items.size).toBe(0)
    expect(h.tokenSeenByApi()).toBeNull()
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.router.currentRoute.value.query.redirect).toBe('/booking')
    expect(h.auth.notice).toBe('登录已过期，请重新登录')
  })

  it('返回地址保留查询参数；重新登录后可以回到该地址（redirect 属于本角色）', async () => {
    const { h, deps } = await loggedIn('admin_tennis', '/venue-admin/reservations?page=2')
    h.clock.advanceMinutes(EIGHT_HOURS_AND_ONE_MINUTE)
    await callApi(() => h.api.adminListReservations(), deps)

    expect(h.router.currentRoute.value.query.redirect).toBe('/venue-admin/reservations?page=2')
  })
})

describe('AUTH_REQUIRED：缺少或无效令牌', () => {
  it('清除登录状态，回到 /login 并带返回地址，登录页提示“请先登录”', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')
    h.auth.$patch({ token: 'forged-token' })

    const result = await callApi(() => h.api.listMyReservations(), deps)

    expect(result).toEqual({ ok: false, code: 'AUTH_REQUIRED', message: '请先登录', sessionEnded: true })
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.storage.items.size).toBe(0)
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.router.currentRoute.value.query.redirect).toBe('/me')
    expect(h.auth.notice).toBe('请先登录')
  })
})

describe('ACCOUNT_DISABLED：账号已停用', () => {
  it('清除登录状态，回到 /login（不带返回地址），登录页提示“账号已停用”', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')
    await h.disableAccount('zhangsan')

    const result = await callApi(() => h.api.listMyReservations(), deps)

    expect(result).toEqual({ ok: false, code: 'ACCOUNT_DISABLED', message: '账号已停用', sessionEnded: true })
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.storage.items.size).toBe(0)
    expect(h.tokenSeenByApi()).toBeNull()
    expect(h.router.currentRoute.value.fullPath).toBe('/login')
    expect(h.auth.notice).toBe('账号已停用')
  })

  it('此时再次登录成功，提示被清除', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')
    await h.disableAccount('zhangsan')
    await callApi(() => h.api.listMyReservations(), deps)

    const result = await h.auth.login({ username: 'wangwu', password: DEMO_PASSWORD })

    expect(result.ok).toBe(true)
    expect(h.auth.notice).toBeNull()
  })
})

describe('其他情况', () => {
  it('不属于登录状态失效的错误原样返回，不清除登录状态、不跳转', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')

    const result = await callApi(() => h.api.getReservation(99999), deps)

    expect(result).toEqual({ ok: false, code: 'NOT_FOUND', message: '资源不存在', sessionEnded: false })
    expect(h.auth.isAuthenticated).toBe(true)
    expect(h.router.currentRoute.value.fullPath).toBe('/me')
  })

  it('成功时返回 value', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')

    const result = await callApi(() => h.api.getMe(), deps)

    expect(result).toMatchObject({ ok: true, value: { username: 'zhangsan' } })
  })

  it('非 ApiError 的异常按 INTERNAL_ERROR 文案返回，不当作登录失效', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')

    const result = await callApi(() => Promise.reject(new Error('boom')), deps)

    expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR', message: '服务器开小差了，请稍后再试', sessionEnded: false })
    expect(h.auth.isAuthenticated).toBe(true)
  })

  it('handleAuthFailure 对非登录失效错误返回 false 且不做任何改动', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')

    expect(await handleAuthFailure(new ApiError(409, 'SLOT_TAKEN', 'x'), deps)).toBe(false)
    expect(await handleAuthFailure(new Error('x'), deps)).toBe(false)
    expect(h.auth.isAuthenticated).toBe(true)
  })

  it('公开页面 /display 上登录状态失效：清除登录状态，但停留在 /display', async () => {
    const { h, deps } = await loggedIn('sysadmin', '/display')

    const handled = await handleAuthFailure(new ApiError(401, 'TOKEN_EXPIRED', 'x'), deps)

    expect(handled).toBe(true)
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.router.currentRoute.value.fullPath).toBe('/display')
  })

  it('已在登录页时不再跳转', async () => {
    const h = createAuthHarness()
    await h.router.push('/login?redirect=/booking')

    const handled = await handleAuthFailure(new ApiError(403, 'ACCOUNT_DISABLED', 'x'), { auth: h.auth, router: h.router })

    expect(handled).toBe(true)
    expect(h.router.currentRoute.value.fullPath).toBe('/login?redirect=/booking')
  })
})

describe('登出', () => {
  it('清除令牌与用户，API 层读不到令牌，回到 /login 且没有提示', async () => {
    const { h, deps } = await loggedIn('admin_pool', '/venue-admin')

    await logoutToLogin(deps)

    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.auth.token).toBeNull()
    expect(h.auth.user).toBeNull()
    expect(h.storage.items.size).toBe(0)
    expect(h.tokenSeenByApi()).toBeNull()
    expect(h.auth.notice).toBeNull()
    expect(h.router.currentRoute.value.fullPath).toBe('/login')
  })

  it('登出后再访问受保护路径 → /login 并带 redirect', async () => {
    const { h, deps } = await loggedIn('zhangsan', '/me')
    await logoutToLogin(deps)
    await h.router.push('/booking')

    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.router.currentRoute.value.query.redirect).toBe('/booking')
  })
})
