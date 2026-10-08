// FE-2 登录页（ACC-M2-01 相关）：登录/注册切换、登录失败文案、注册的前端校验提示、启动恢复后的提示。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LoginView from '../../src/views/LoginView.vue'
import { createAuthHarness, DEMO_PASSWORD, START, type AuthHarness } from '../auth/harness'
import { mountWithApp, texts } from './support'

const EXPIRED_AT = '2026-10-12T17:00:00'
const EXPIRED_NOTICE = '登录已过期，请重新登录'

async function openLogin(h: AuthHarness): Promise<VueWrapper> {
  await h.router.push('/login')
  await h.router.isReady()
  return mountWithApp(LoginView, h)
}

function field(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('label').find((node) => node.text().startsWith(label))
  if (found === undefined) {
    throw new Error(`找不到字段“${label}”`)
  }
  return found
}

async function fill(wrapper: VueWrapper, values: Record<string, string>): Promise<void> {
  for (const [label, value] of Object.entries(values)) {
    await field(wrapper, label).find('input').setValue(value)
  }
}

async function submit(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

function errorText(wrapper: VueWrapper): string | null {
  const node = wrapper.find('[role="alert"]')
  return node.exists() ? node.text() : null
}

function noticeText(wrapper: VueWrapper): string | null {
  const node = wrapper.find('[role="status"]')
  return node.exists() ? node.text() : null
}

function labelNames(wrapper: VueWrapper): string[] {
  return wrapper.findAll('label').map((label) => label.element.firstChild?.textContent?.trim() ?? '')
}

function selectedTabs(wrapper: VueWrapper): (string | undefined)[] {
  return wrapper.findAll('[role="tab"]').map((tab) => tab.attributes('aria-selected'))
}

describe('登录/注册切换', () => {
  it('默认是登录：提交按钮为“登录”，只有用户名与密码两个输入，登录标签被选中', async () => {
    const wrapper = await openLogin(createAuthHarness())

    expect(texts(wrapper, '[role="tab"]')).toEqual(['登录', '注册'])
    expect(selectedTabs(wrapper)).toEqual(['true', 'false'])
    expect(wrapper.find('button[type="submit"]').text()).toBe('登录')
    expect(labelNames(wrapper)).toEqual(['用户名', '密码'])
  })

  it('切到“注册”：出现姓名、身份、手机号，提交按钮变为“注册并登录”；切回“登录”后这些字段消失', async () => {
    const wrapper = await openLogin(createAuthHarness())

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    expect(selectedTabs(wrapper)).toEqual(['false', 'true'])
    expect(wrapper.find('button[type="submit"]').text()).toBe('注册并登录')
    expect(labelNames(wrapper)).toEqual(['用户名', '密码', '姓名', '身份（选填）', '手机号（选填）'])
    expect(field(wrapper, '身份').findAll('option').map((option) => option.text())).toEqual(['不填写', '学生', '教师', '其他'])

    await wrapper.findAll('[role="tab"]')[0]?.trigger('click')
    expect(wrapper.find('button[type="submit"]').text()).toBe('登录')
    expect(labelNames(wrapper)).toEqual(['用户名', '密码'])
  })

  it('切换模式会清掉上一次的错误提示', async () => {
    const wrapper = await openLogin(createAuthHarness())
    await submit(wrapper)
    expect(errorText(wrapper)).toBe('请输入用户名')

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    expect(errorText(wrapper)).toBeNull()
  })
})

describe('登录失败', () => {
  it('密码错误：显示“用户名或密码错误”，仍停留在登录页，没有登录', async () => {
    const h = createAuthHarness()
    const wrapper = await openLogin(h)
    await fill(wrapper, { 用户名: 'zhangsan', 密码: 'wrong-password' })
    await submit(wrapper)

    expect(errorText(wrapper)).toBe('用户名或密码错误')
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('空用户名、空密码：提交前就给出提示，不登录', async () => {
    const h = createAuthHarness()
    const wrapper = await openLogin(h)
    await submit(wrapper)
    expect(errorText(wrapper)).toBe('请输入用户名')

    await fill(wrapper, { 用户名: 'zhangsan' })
    await submit(wrapper)
    expect(errorText(wrapper)).toBe('请输入密码')
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('正确的账号密码：没有错误提示，跳转到用户端首页', async () => {
    const h = createAuthHarness()
    const wrapper = await openLogin(h)
    await fill(wrapper, { 用户名: 'zhangsan', 密码: DEMO_PASSWORD })
    await submit(wrapper)

    expect(errorText(wrapper)).toBeNull()
    expect(h.router.currentRoute.value.path).toBe('/')
    expect(h.auth.user?.username).toBe('zhangsan')
  })
})

describe('注册的前端校验提示', () => {
  async function openRegister(h: AuthHarness): Promise<VueWrapper> {
    const wrapper = await openLogin(h)
    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    return wrapper
  }

  it.each([
    ['用户名太短', { 用户名: 'ab', 密码: 'abcd1234', 姓名: '新用户' }, '用户名需为 3–32 位字母、数字或下划线'],
    ['用户名含非法字符', { 用户名: 'new user', 密码: 'abcd1234', 姓名: '新用户' }, '用户名需为 3–32 位字母、数字或下划线'],
    ['密码太短', { 用户名: 'newuser', 密码: 'abc123', 姓名: '新用户' }, '密码需为 8–64 位'],
    ['密码太长', { 用户名: 'newuser', 密码: 'a'.repeat(65), 姓名: '新用户' }, '密码需为 8–64 位'],
    ['姓名为空白', { 用户名: 'newuser', 密码: 'abcd1234', 姓名: '   ' }, '请填写姓名'],
  ])('%s：显示提示并且不会注册', async (_title, values, message) => {
    const h = createAuthHarness()
    const wrapper = await openRegister(h)
    await fill(wrapper, values)
    await submit(wrapper)

    expect(errorText(wrapper)).toBe(message)
    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.router.currentRoute.value.path).toBe('/login')
  })

  it('用户名已被占用：提示来自服务端错误码文案', async () => {
    const wrapper = await openRegister(createAuthHarness())
    await fill(wrapper, { 用户名: 'zhangsan', 密码: 'abcd1234', 姓名: '重名' })
    await submit(wrapper)

    expect(errorText(wrapper)).toBe('用户名已被占用')
  })

  it('信息合法：注册并登录成功，进入用户端首页', async () => {
    const h = createAuthHarness()
    const wrapper = await openRegister(h)
    await fill(wrapper, { 用户名: 'newuser', 密码: 'abcd1234', 姓名: '新用户' })
    await submit(wrapper)

    expect(errorText(wrapper)).toBeNull()
    expect(h.router.currentRoute.value.path).toBe('/')
    expect(h.auth.user?.displayName).toBe('新用户')
  })
})

describe('启动恢复后的提示', () => {
  async function expiredHarness(): Promise<AuthHarness> {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    h.clock.set(EXPIRED_AT)
    return h
  }

  it('没有失败的恢复：登录页没有提示', async () => {
    expect(noticeText(await openLogin(createAuthHarness()))).toBeNull()
  })

  it('本地判定令牌已过期：显示“登录已过期，请重新登录”', async () => {
    const reloaded = (await expiredHarness()).reload()
    await reloaded.auth.restore()

    expect(noticeText(await openLogin(reloaded))).toBe(EXPIRED_NOTICE)
  })

  it('服务端判定令牌过期（本地时钟认为未过期）：同样显示过期提示', async () => {
    const reloaded = (await expiredHarness()).reload({ now: () => START })
    await reloaded.auth.restore()

    expect(noticeText(await openLogin(reloaded))).toBe(EXPIRED_NOTICE)
  })

  it('账号已被停用：显示“账号已停用”', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    await h.disableAccount('zhangsan')
    const reloaded = h.reload()
    await reloaded.auth.restore()

    expect(noticeText(await openLogin(reloaded))).toBe('账号已停用')
  })

  it('再次提交登录后提示消失，只剩本次的错误', async () => {
    const reloaded = (await expiredHarness()).reload()
    await reloaded.auth.restore()
    const wrapper = await openLogin(reloaded)
    expect(noticeText(wrapper)).toBe(EXPIRED_NOTICE)

    await fill(wrapper, { 用户名: 'zhangsan', 密码: 'wrong-password' })
    await submit(wrapper)
    expect(noticeText(wrapper)).toBeNull()
    expect(errorText(wrapper)).toBe('用户名或密码错误')
  })
})
