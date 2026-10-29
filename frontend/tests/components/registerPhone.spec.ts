// SEC-2c 注册页与系统管理员“新建账号”的手机号（SEC-2c 裁决已定事项第 4 条；docs/12 第 5.1、5.9 节 v1.3）：
// 注册时手机号必填、11 位格式提示、“身份”在最下方；系统管理员创建普通用户时手机号必填，创建管理员时可不填。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { VenueSummary } from '../../src/api/types'
import UserCreateDialog from '../../src/components/sys-admin/users/UserCreateDialog.vue'
import type { CreateUserState } from '../../src/composables/sysUsers'
import { emptyUserForm, userFormProblem } from '../../src/utils/sysUserDisplay'
import LoginView from '../../src/views/LoginView.vue'
import { createAuthHarness, type AuthHarness } from '../auth/harness'
import { mountWithApp } from './support'

const labelNames = (wrapper: VueWrapper) => wrapper.findAll('label').map((label) => label.element.firstChild?.textContent?.trim() ?? '')

function control(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('label').find((node) => node.element.firstChild?.textContent?.trim() === label)
  if (found === undefined) {
    throw new Error(`找不到字段“${label}”`)
  }
  return found.find('input, select')
}

async function openRegister(h: AuthHarness): Promise<VueWrapper> {
  await h.router.push('/login')
  await h.router.isReady()
  const wrapper = mountWithApp(LoginView, h)
  await wrapper.findAll('[role="tab"]')[1]?.trigger('click')
  return wrapper
}

async function register(wrapper: VueWrapper, phone: string): Promise<void> {
  await control(wrapper, '用户名').setValue('newuser')
  await control(wrapper, '密码').setValue('abcd1234')
  await control(wrapper, '姓名').setValue('新用户')
  await control(wrapper, '手机号').setValue(phone)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('注册页的手机号', () => {
  it('手机号必填（标签不带“选填”）、type=tel、maxlength 11，下方有说明；“身份（选填）”是最后一个字段', async () => {
    const wrapper = await openRegister(createAuthHarness())
    const phone = control(wrapper, '手机号')

    expect(labelNames(wrapper).at(-1)).toBe('身份（选填）')
    expect([phone.attributes('type'), phone.attributes('maxlength'), phone.attributes('inputmode')]).toEqual(['tel', '11', 'numeric'])
    const hintId = phone.attributes('aria-describedby') ?? ''
    expect(wrapper.get(`[id="${hintId}"]`).text()).toBe('11 位手机号，可用于找回密码')
  })

  it.each([
    ['不填', ''],
    ['10 位', '1380000000'],
    ['含空格', '138 0000 0000'],
    ['含短横线', '138-0000-000'],
    ['不以 1 开头', '23800000000'],
  ])('手机号%s：提示“请输入 11 位手机号”，不会注册', async (_label, phone) => {
    const h = createAuthHarness()
    const wrapper = await openRegister(h)
    await register(wrapper, phone)

    expect(wrapper.find('[role="alert"]').text()).toBe('请输入 11 位手机号')
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('11 位手机号（首尾空白会去掉）：注册成功，手机号原样登记', async () => {
    const h = createAuthHarness()
    const wrapper = await openRegister(h)
    await register(wrapper, ' 13800000000 ')

    expect(h.router.currentRoute.value.path).toBe('/')
    expect(h.auth.user?.phone).toBe('13800000000')
  })
})

describe('系统管理员新建账号的手机号', () => {
  const base = { ...emptyUserForm(), username: 'abc', password: '12345678', displayName: '甲' }

  it('普通用户：不填或格式不对提示“请输入 11 位手机号”；11 位通过', () => {
    expect(userFormProblem({ ...base, role: 'USER', phone: '' })).toBe('请输入 11 位手机号')
    expect(userFormProblem({ ...base, role: 'USER', phone: '1380000000' })).toBe('请输入 11 位手机号')
    expect(userFormProblem({ ...base, role: 'USER', phone: ' 13800000000 ' })).toBeNull()
  })

  it('管理员：可不填；填了同样校验格式', () => {
    expect(userFormProblem({ ...base, role: 'VENUE_ADMIN', phone: '' })).toBeNull()
    expect(userFormProblem({ ...base, role: 'SYS_ADMIN', phone: '  ' })).toBeNull()
    expect(userFormProblem({ ...base, role: 'SYS_ADMIN', phone: '12345' })).toBe('请输入 11 位手机号')
  })

  it('对话框：普通用户标签为“手机号”，管理员为“手机号（可选）”；type=tel、maxlength 11', () => {
    const venues = [{ id: 1, name: '网球馆' }] as unknown as VenueSummary[]
    const open = (role: CreateUserState['role']) => mount(UserCreateDialog, {
      props: { state: { ...emptyUserForm(role), busy: false, error: null }, venues },
    })
    const phoneLabels = (wrapper: VueWrapper) => labelNames(wrapper).filter((name) => name.startsWith('手机号'))

    expect(phoneLabels(open('USER'))).toEqual(['手机号'])
    expect(phoneLabels(open('VENUE_ADMIN'))).toEqual(['手机号（可选）'])
    expect(phoneLabels(open('SYS_ADMIN'))).toEqual(['手机号（可选）'])
    const phone = control(open('USER'), '手机号')
    expect([phone.attributes('type'), phone.attributes('maxlength')]).toEqual(['tel', '11'])
  })
})
