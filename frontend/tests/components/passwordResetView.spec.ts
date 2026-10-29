// SEC-2c 找回密码页与登录页入口（SEC-2c 裁决已定事项第 1 条、第 3 节答复第 3、4 条；docs/17 登录页观感）。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { api } from '../../src/api/index'
import LoginView from '../../src/views/LoginView.vue'
import PasswordResetView from '../../src/views/PasswordResetView.vue'
import { createAuthHarness, type AuthHarness } from '../auth/harness'
import { mountWithApp, texts } from './support'

// 页面经 api/index.ts 调用接口（应用默认的 mock 实例），所以测试账号也注册在这个实例上。
const OWNER = { username: 'stu01', password: 'Passw0rd!', displayName: '周八', phone: '13800000001' }

async function openAt(h: AuthHarness, path: string, view: typeof LoginView): Promise<VueWrapper> {
  await h.router.push(path)
  await h.router.isReady()
  return mountWithApp(view, h)
}

function labelNames(wrapper: VueWrapper): string[] {
  return wrapper.findAll('label').map((label) => label.element.firstChild?.textContent?.trim() ?? '')
}

function control(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('label').find((node) => node.element.firstChild?.textContent?.trim() === label)
  if (found === undefined) {
    throw new Error(`找不到字段“${label}”`)
  }
  return found.find('input')
}

async function fill(wrapper: VueWrapper, values: Record<string, string>): Promise<void> {
  for (const [label, value] of Object.entries(values)) {
    await control(wrapper, label).setValue(value)
  }
}

async function submit(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

const RIGHT = { '用户名（学号）': 'stu01', 姓名: '周八', 手机号: '13800000001', 新密码: 'NewPassw0rd!', 再输入一次: 'NewPassw0rd!' }

describe('登录页的“忘记密码？”入口', () => {
  it('登录模式显示，指向 /password-reset；切到注册后不显示', async () => {
    const wrapper = await openAt(createAuthHarness(), '/login', LoginView)
    const link = wrapper.findAll('a').find((node) => node.text() === '忘记密码？')
    expect(link?.attributes('href')).toBe('/password-reset')

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
    expect(wrapper.findAll('a').map((node) => node.text())).not.toContain('忘记密码？')
  })
})

describe('找回密码页', () => {
  it('空白状态：标题、五个字段（一次提交）、两条常驻提示、“重置密码”与“返回登录”', async () => {
    const wrapper = await openAt(createAuthHarness(), '/password-reset', PasswordResetView)

    expect(wrapper.find('h1').text()).toBe('找回密码')
    expect(labelNames(wrapper)).toEqual(['用户名（学号）', '姓名', '手机号', '新密码', '再输入一次'])
    expect(texts(wrapper, '.hints li')).toEqual(['24 小时内最多可尝试 7 次。', '如果注册时没有填写手机号，请联系系统管理员。'])
    expect(wrapper.find('button[type="submit"]').text()).toBe('重置密码')
    expect(wrapper.findAll('a').find((node) => node.text() === '返回登录')?.attributes('href')).toBe('/login')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('输入属性：手机号 type=tel、maxlength 11；新密码两项 type=password、autocomplete=new-password', async () => {
    const wrapper = await openAt(createAuthHarness(), '/password-reset', PasswordResetView)

    expect([control(wrapper, '手机号').attributes('type'), control(wrapper, '手机号').attributes('maxlength')]).toEqual(['tel', '11'])
    expect(control(wrapper, '用户名（学号）').attributes('maxlength')).toBe('32')
    for (const label of ['新密码', '再输入一次']) {
      expect([control(wrapper, label).attributes('type'), control(wrapper, label).attributes('autocomplete')]).toEqual(['password', 'new-password'])
    }
  })

  it('提交前校验：两次密码不一致，提示显示在页面里（role=alert）', async () => {
    const wrapper = await openAt(createAuthHarness(), '/password-reset', PasswordResetView)
    await fill(wrapper, { ...RIGHT, 再输入一次: 'Other0ne!!' })
    await submit(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toBe('两次输入的新密码不一致')
  })

  it('信息不匹配：显示剩余次数', async () => {
    const wrapper = await openAt(createAuthHarness(), '/password-reset', PasswordResetView)
    await fill(wrapper, { ...RIGHT, '用户名（学号）': 'nobody_here', 手机号: '13800000002' })
    await submit(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toBe('信息不匹配，剩余可尝试 6 次')
  })

  it('成功：回到登录页，显示“密码已重置，请用新密码登录”，用户名已预填、密码为空', async () => {
    const h = createAuthHarness()
    await api.register(OWNER)
    const reset = await openAt(h, '/password-reset', PasswordResetView)
    await fill(reset, RIGHT)
    await submit(reset)
    expect(h.router.currentRoute.value.path).toBe('/login')

    const login = mountWithApp(LoginView, h)
    expect(login.find('[role="status"]').text()).toBe('密码已重置，请用新密码登录')
    const inputs = login.findAll('input')
    expect([(inputs[0]?.element as HTMLInputElement).value, (inputs[1]?.element as HTMLInputElement).value]).toEqual(['stu01', ''])
  })
})
