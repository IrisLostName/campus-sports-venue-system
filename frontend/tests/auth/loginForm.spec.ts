// 登录/注册表单的提交流程：按角色跳转、redirect 处理、错误文案、提交前校验（docs/12 第 5.1 节）。
import { describe, expect, it } from 'vitest'

import type { RegisterRequest } from '../../src/api/requests'
import { createLoginForm, type LoginFormAuth } from '../../src/composables/loginForm'
import type { AuthResult } from '../../src/stores/auth'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from './harness'

async function openLogin(h: AuthHarness, query = '') {
  await h.router.push(`/login${query}`)
  return createLoginForm({ auth: h.auth, router: h.router })
}

function path(h: AuthHarness): string {
  return h.router.currentRoute.value.fullPath
}

describe('ACC-M2-01 三种角色登录后进入各自入口', () => {
  it.each([
    ['zhangsan', '/'],
    ['admin_tennis', '/venue-admin'],
    ['sysadmin', '/sys-admin'],
  ])('%s 登录 → %s', async (username, entry) => {
    const h = createAuthHarness()
    const form = await openLogin(h)
    form.username.value = username
    form.password.value = DEMO_PASSWORD
    await form.submit()

    expect(path(h)).toBe(entry)
    expect(form.error.value).toBeNull()
    expect(h.auth.user?.username).toBe(username)
    expect(form.busy.value).toBe(false)
  })

  it('登录后跳回 redirect（属于本角色时）', async () => {
    const h = createAuthHarness()
    const form = await openLogin(h, '?redirect=/booking')
    form.username.value = 'zhangsan'
    form.password.value = DEMO_PASSWORD
    await form.submit()

    expect(path(h)).toBe('/booking')
  })

  it.each([
    ['admin_tennis', '/booking', '/venue-admin'],
    ['zhangsan', '/sys-admin', '/'],
    ['sysadmin', '/venue-admin/x', '/sys-admin'],
    ['zhangsan', '//evil.example', '/'],
  ])('%s 的 redirect=%s 不属于本角色 → 进入本角色入口 %s', async (username, redirect, entry) => {
    const h = createAuthHarness()
    const form = await openLogin(h, `?redirect=${encodeURIComponent(redirect)}`)
    form.username.value = username
    form.password.value = DEMO_PASSWORD
    await form.submit()

    expect(path(h)).toBe(entry)
  })
})

describe('登录失败显示对应文案', () => {
  it('INVALID_CREDENTIALS → 用户名或密码错误；停留在登录页', async () => {
    const h = createAuthHarness()
    const form = await openLogin(h)
    form.username.value = 'zhangsan'
    form.password.value = 'wrong-password'
    await form.submit()

    expect(form.error.value).toBe('用户名或密码错误')
    expect(path(h)).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
    expect(form.busy.value).toBe(false)
  })

  it('ACCOUNT_DISABLED → 账号已停用；停留在登录页', async () => {
    const h = createAuthHarness()
    await h.disableAccount('lisi')
    const form = await openLogin(h)
    form.username.value = 'lisi'
    form.password.value = DEMO_PASSWORD
    await form.submit()

    expect(form.error.value).toBe('账号已停用')
    expect(path(h)).toBe('/login')
  })

  it('用户名或密码为空：提示填写，不发起登录', async () => {
    const h = createAuthHarness()
    const form = await openLogin(h)
    await form.submit()
    expect(form.error.value).toBe('请输入用户名')

    form.username.value = 'zhangsan'
    await form.submit()
    expect(form.error.value).toBe('请输入密码')
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('再次提交成功后错误提示被清除', async () => {
    const h = createAuthHarness()
    const form = await openLogin(h)
    form.username.value = 'zhangsan'
    form.password.value = 'wrong-password'
    await form.submit()
    form.password.value = DEMO_PASSWORD
    await form.submit()

    expect(form.error.value).toBeNull()
    expect(path(h)).toBe('/')
  })
})

async function openRegister(h: AuthHarness) {
  const form = await openLogin(h)
  form.switchMode('register')
  form.username.value = 'newcomer'
  form.password.value = 'Passw0rd!'
  form.displayName.value = '新同学'
  return form
}

describe('注册：成功与服务端错误', () => {
  it('成功：以 USER 登录并进入 /（与登录同一流程）', async () => {
    const h = createAuthHarness()
    const form = await openRegister(h)
    await form.submit()

    expect(path(h)).toBe('/')
    expect(h.auth.user).toMatchObject({ username: 'newcomer', displayName: '新同学', role: 'USER' })
    expect(form.error.value).toBeNull()
  })

  it('成功后同样遵循 redirect', async () => {
    const h = createAuthHarness()
    await h.router.push('/login?redirect=/booking')
    const form = createLoginForm({ auth: h.auth, router: h.router })
    form.switchMode('register')
    form.username.value = 'newcomer'
    form.password.value = 'Passw0rd!'
    form.displayName.value = '新同学'
    await form.submit()

    expect(path(h)).toBe('/booking')
  })

  it('USERNAME_TAKEN → 用户名已被占用；停留在登录页', async () => {
    const h = createAuthHarness()
    const form = await openRegister(h)
    form.username.value = 'zhangsan'
    await form.submit()

    expect(form.error.value).toBe('用户名已被占用')
    expect(path(h)).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
  })

})

describe('注册：提交前校验', () => {
  it.each([
    ['用户名过短', { username: 'ab' }, '用户名需为 3–32 位字母、数字或下划线'],
    ['用户名过长', { username: 'a'.repeat(33) }, '用户名需为 3–32 位字母、数字或下划线'],
    ['用户名含非法字符', { username: 'bad-name' }, '用户名需为 3–32 位字母、数字或下划线'],
    ['密码过短', { password: '1234567' }, '密码需为 8–64 位'],
    ['密码过长', { password: 'p'.repeat(65) }, '密码需为 8–64 位'],
    ['姓名为空', { displayName: '  ' }, '请填写姓名'],
  ])('提交前校验：%s', async (_label, patch, hint) => {
    const h = createAuthHarness()
    const form = await openRegister(h)
    const fields: { username?: string; password?: string; displayName?: string } = patch
    form.username.value = fields.username ?? form.username.value
    form.password.value = fields.password ?? form.password.value
    form.displayName.value = fields.displayName ?? form.displayName.value
    await form.submit()

    expect(form.error.value).toBe(hint)
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('边界合法：用户名 3 位与 32 位、密码 8 位与 64 位都能提交', async () => {
    for (const [username, password] of [['abc', '12345678'], ['a_'.repeat(16), 'p'.repeat(64)]]) {
      const h = createAuthHarness()
      const form = await openRegister(h)
      form.username.value = username as string
      form.password.value = password as string
      await form.submit()

      expect(form.error.value).toBeNull()
      expect(h.auth.isAuthenticated).toBe(true)
    }
  })

})

describe('注册：与服务端的交互', () => {
  it('服务端返回 VALIDATION_ERROR 时按错误码显示文案（绕过提交前校验）', async () => {
    const calls: RegisterRequest[] = []
    const rejecting: LoginFormAuth = {
      login: () => Promise.reject(new Error('不应调用')),
      register: (request): Promise<AuthResult> => {
        calls.push(request)
        return Promise.resolve({ ok: false, code: 'VALIDATION_ERROR', message: '请求参数不合法' })
      },
    }
    const h = createAuthHarness()
    const form = createLoginForm({ auth: rejecting, router: h.router })
    form.switchMode('register')
    form.username.value = 'newcomer'
    form.password.value = 'Passw0rd!'
    form.displayName.value = '新同学'
    await form.submit()

    expect(calls).toHaveLength(1)
    expect(form.error.value).toBe('请求参数不合法')
  })

  it('请求只带有填写过的可选字段；姓名与手机号去掉首尾空格', async () => {
    const calls: RegisterRequest[] = []
    const recording: LoginFormAuth = {
      login: () => Promise.reject(new Error('不应调用')),
      register: (request): Promise<AuthResult> => {
        calls.push(request)
        return Promise.resolve({ ok: false, code: 'USERNAME_TAKEN', message: '用户名已被占用' })
      },
    }
    const h = createAuthHarness()
    const form = createLoginForm({ auth: recording, router: h.router })
    form.switchMode('register')
    form.username.value = 'newcomer'
    form.password.value = 'Passw0rd!'
    form.displayName.value = ' 新同学 '
    await form.submit()
    form.userType.value = 'TEACHER'
    form.phone.value = ' 13800000000 '
    await form.submit()

    expect(calls[0]).toEqual({ username: 'newcomer', password: 'Passw0rd!', displayName: '新同学' })
    expect(calls[1]).toEqual({
      username: 'newcomer', password: 'Passw0rd!', displayName: '新同学', userType: 'TEACHER', phone: '13800000000',
    })
  })

  it('切换登录/注册会清除上一次的错误提示', async () => {
    const h = createAuthHarness()
    const form = await openLogin(h)
    await form.submit()
    expect(form.error.value).not.toBeNull()

    form.switchMode('register')
    expect(form.error.value).toBeNull()
    expect(form.isRegister.value).toBe(true)
  })
})
