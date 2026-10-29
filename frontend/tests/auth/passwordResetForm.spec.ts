// SEC-2c 找回密码表单（docs/12 第 5.1 节 v1.3；SEC-2c 裁决已定事项第 1、2 条与第 3 节答复第 1–4 条）：
// 提交前校验、各错误码的文案、成功后回到登录页（成功提示 + 预填用户名）、已登录会话遇到 TOKEN_EXPIRED 回到登录页。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { PasswordResetRequest } from '../../src/api/requests'
import { createLoginForm } from '../../src/composables/loginForm'
import { createPasswordResetForm, type PasswordResetFormDeps } from '../../src/composables/passwordResetForm'
import { callApi } from '../../src/composables/session'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from './harness'

const OWNER = { username: 'stu01', password: 'Passw0rd!', displayName: '周八', phone: '13800000001' }

async function openReset(h: AuthHarness, overrides: Partial<PasswordResetFormDeps> = {}) {
  await h.router.push('/password-reset')
  return createPasswordResetForm({
    resetPassword: (request) => h.api.resetPassword(request),
    done: (username, message) => h.auth.passwordResetDone(username, message),
    router: h.router,
    ...overrides,
  })
}

type Form = Awaited<ReturnType<typeof openReset>>

function fillAll(form: Form, values: Partial<Record<'username' | 'displayName' | 'phone' | 'newPassword' | 'confirmPassword', string>> = {}): void {
  form.username.value = values.username ?? 'stu01'
  form.displayName.value = values.displayName ?? '周八'
  form.phone.value = values.phone ?? '13800000001'
  form.newPassword.value = values.newPassword ?? 'NewPassw0rd!'
  form.confirmPassword.value = values.confirmPassword ?? values.newPassword ?? 'NewPassw0rd!'
}

async function withOwner(): Promise<AuthHarness> {
  const h = createAuthHarness()
  await h.api.register(OWNER)
  return h
}

function path(h: AuthHarness): string {
  return h.router.currentRoute.value.fullPath
}

describe('找回密码：提交前校验（不发请求）', () => {
  it.each([
    ['用户名为空白', { username: '  ' }, '请输入用户名'],
    ['姓名为空白', { displayName: ' ' }, '请填写姓名'],
    ['手机号 10 位', { phone: '1380000000' }, '请输入 11 位手机号'],
    ['手机号带短横线', { phone: '138-0000-0001' }, '请输入 11 位手机号'],
    ['手机号不以 1 开头', { phone: '23800000001' }, '请输入 11 位手机号'],
    ['新密码 7 位', { newPassword: '1234567' }, '密码需为 8–64 位'],
    ['新密码 65 位', { newPassword: 'p'.repeat(65) }, '密码需为 8–64 位'],
    ['两次输入不一致', { confirmPassword: 'Other0ne!!' }, '两次输入的新密码不一致'],
  ])('%s → “%s”', async (_label, patch, message) => {
    const calls: PasswordResetRequest[] = []
    const h = createAuthHarness()
    const form = await openReset(h, { resetPassword: (request) => { calls.push(request); return Promise.resolve() } })
    fillAll(form, patch)
    await form.submit()

    expect(form.error.value).toBe(message)
    expect(calls).toEqual([])
    expect(path(h)).toBe('/password-reset')
  })

  it('用户名、姓名、手机号去掉首尾空白后发送，新密码原样发送', async () => {
    const calls: PasswordResetRequest[] = []
    const h = createAuthHarness()
    const form = await openReset(h, { resetPassword: (request) => { calls.push(request); return Promise.resolve() } })
    fillAll(form, { username: ' stu01 ', displayName: ' 周八 ', phone: ' 13800000001 ', newPassword: ' NewPassw0rd! ' })
    await form.submit()

    expect(calls).toEqual([{ username: 'stu01', displayName: '周八', phone: '13800000001', newPassword: ' NewPassw0rd! ' }])
  })
})

describe('找回密码：服务端结果', () => {
  it('RESET_INFO_MISMATCH：显示剩余次数 6、5；第 7 次（剩余 0 次）显示次数已用完', async () => {
    const h = await withOwner()
    const form = await openReset(h)
    fillAll(form, { phone: '13800000002' })
    await form.submit()
    expect(form.error.value).toBe('信息不匹配，剩余可尝试 6 次')
    await form.submit()
    expect(form.error.value).toBe('信息不匹配，剩余可尝试 5 次')
    for (let index = 0; index < 5; index += 1) {
      await form.submit()
    }
    expect(form.error.value).toBe('信息不匹配，尝试次数已用完，请 24 小时后再试或联系系统管理员')
    expect(path(h)).toBe('/password-reset')
    expect(form.busy.value).toBe(false)
  })

  it('PASSWORD_RESET_LOCKED：显示解锁时刻（有秒时向上取整到下一分钟）；输入信息正确也不会重置', async () => {
    const h = await withOwner()
    h.clock.set('2026-10-12T09:00:30')
    const form = await openReset(h)
    fillAll(form, { displayName: '周 八' })
    for (let index = 0; index < 7; index += 1) {
      await form.submit()
    }
    fillAll(form)
    await form.submit()

    expect(form.error.value).toBe('尝试次数过多，请在 2026-10-13 09:01 之后再试，或联系系统管理员')
    expect((await h.api.login({ username: 'stu01', password: 'Passw0rd!' })).user.username).toBe('stu01')
  })

  it('服务端 VALIDATION_ERROR（绕过提交前校验）：按错误码显示“请求参数不合法”', async () => {
    const h = createAuthHarness()
    const form = await openReset(h, {
      resetPassword: () => Promise.reject(new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', { fields: { phone: '应为 11 位手机号' } })),
    })
    fillAll(form)
    await form.submit()

    expect(form.error.value).toBe('请求参数不合法')
    expect(path(h)).toBe('/password-reset')
  })

  it('成功：回到 /login，登录页留下成功提示并预填用户名（只取一次，不预填密码）；新密码可以登录', async () => {
    const h = await withOwner()
    const form = await openReset(h)
    fillAll(form)
    await form.submit()

    expect(form.error.value).toBeNull()
    expect(path(h)).toBe('/login')
    expect(h.auth.success).toBe('密码已重置，请用新密码登录')
    const login = createLoginForm({ auth: h.auth, router: h.router, initialUsername: h.auth.takePrefillUsername() })
    expect([login.username.value, login.password.value]).toEqual(['stu01', ''])
    expect(h.auth.takePrefillUsername()).toBe('')

    login.password.value = 'NewPassw0rd!'
    await login.submit()
    expect(path(h)).toBe('/')
    expect(h.auth.success).toBeNull()
  })

  it('成功提示在登出后清除；成功会清掉此前的失效提示', async () => {
    const h = createAuthHarness()
    h.auth.invalidate('TOKEN_EXPIRED')
    h.auth.passwordResetDone('stu01', '密码已重置，请用新密码登录')
    expect([h.auth.notice, h.auth.success]).toEqual([null, '密码已重置，请用新密码登录'])
    h.auth.logout()
    expect(h.auth.success).toBeNull()
  })
})

describe('路由与已登录会话', () => {
  it('/password-reset 未登录可访问；已登录访问回到本角色入口', async () => {
    const guest = createAuthHarness()
    await guest.router.push('/password-reset')
    expect(path(guest)).toBe('/password-reset')
    const user = createAuthHarness()
    await user.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    await user.router.push('/password-reset')
    expect(path(user)).toBe('/')
  })

  it('已登录的会话在别处被找回密码后遇到 TOKEN_EXPIRED：按现有流程回到登录页并提示过期', async () => {
    const h = await withOwner()
    await h.auth.login({ username: 'stu01', password: 'Passw0rd!' })
    await h.router.push('/booking')
    h.clock.advanceMinutes(1)
    await h.api.resetPassword({ username: 'stu01', displayName: '周八', phone: '13800000001', newPassword: 'NewPassw0rd!' })

    const result = await callApi(() => h.api.listMyReservations(), { auth: h.auth, router: h.router })

    expect(result).toMatchObject({ ok: false, code: 'TOKEN_EXPIRED', sessionEnded: true })
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.auth.notice).toBe('登录已过期，请重新登录')
  })
})
