// FE-8 L14（FE-6 N3）：UserCreateDialog 直接挂载——打开 / 关闭、字段属性与规则说明（L10）、按角色出现的字段、事件、错误与忙碌。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { VenueSummary } from '../../../src/api/types'
import type { CreateUserState } from '../../../src/composables/sysUsers'
import UserCreateDialog from '../../../src/components/sys-admin/users/UserCreateDialog.vue'

const VENUES = [
  { id: 1, name: '网球馆' }, { id: 2, name: '羽毛球馆' },
] as unknown as VenueSummary[]

function state(overrides: Partial<CreateUserState> = {}): CreateUserState {
  return {
    username: '', password: '', displayName: '', role: 'USER', userType: 'STUDENT', phone: '', venueIds: [], busy: false, error: null,
    ...overrides,
  }
}

function open(current: CreateUserState | null, props: { fixedRole?: 'VENUE_ADMIN' } = {}) {
  return mount(UserCreateDialog, { props: { state: current, venues: VENUES, ...props } })
}

// 每个 UiTextField 标签的第一行文字（标签文字是 <label> 的第一个子节点）。
const labels = (dialog: ReturnType<typeof open>) => dialog.findAll('label.label').map((node) => node.element.firstChild?.textContent?.trim() ?? '')

describe('打开与关闭', () => {
  it('state 为空时什么都不渲染；有 state 时显示标题“新建账号”与“取消”“创建”', () => {
    expect(open(null).find('[role="dialog"]').exists()).toBe(false)

    const dialog = open(state())
    expect(dialog.get('[role="dialog"] h2').text()).toBe('新建账号')
    expect(dialog.findAll('button').map((button) => button.text())).toEqual(['取消', '创建'])
  })

  it('“创建”发出 confirm，“取消”发出 dismiss', async () => {
    const dialog = open(state())

    await dialog.findAll('button')[1]?.trigger('click')
    await dialog.findAll('button')[0]?.trigger('click')

    expect(dialog.emitted('confirm')).toHaveLength(1)
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })
})

describe('字段与规则说明', () => {
  it('用户名、密码：maxlength 32 / 64，密码 type=password、autocomplete=new-password，规则说明与输入框关联（L10）', () => {
    const dialog = open(state())
    const username = dialog.get('input[autocomplete="off"]')
    const password = dialog.get('input[type="password"]')

    expect(username.attributes('maxlength')).toBe('32')
    expect(password.attributes('maxlength')).toBe('64')
    expect(password.attributes('autocomplete')).toBe('new-password')
    expect(dialog.get(`[id="${username.attributes('aria-describedby')}"]`).text()).toBe('3–32 位字母、数字或下划线')
    expect(dialog.get(`[id="${password.attributes('aria-describedby')}"]`).text()).toBe('8–64 位')
  })

  it('密码不出现在页面文字里', () => {
    const dialog = open(state({ password: 'S3cret-Pass-9' }))

    expect(dialog.text()).not.toContain('S3cret-Pass-9')
    expect(dialog.get('input[type="password"]').attributes('type')).toBe('password')
  })

  it('输入发出 patch：只带被改的字段', async () => {
    const dialog = open(state())

    await dialog.get('input[autocomplete="off"]').setValue('new_user')
    await dialog.get('input[type="password"]').setValue('abcd1234')

    expect(dialog.emitted('patch')).toEqual([[{ username: 'new_user' }], [{ password: 'abcd1234' }]])
  })
})

describe('按角色出现的字段', () => {
  it('USER：有“角色”“用户类型”，没有授权场馆；VENUE_ADMIN：有授权场馆（场馆多选），没有用户类型', () => {
    const user = open(state({ role: 'USER' }))
    expect(labels(user)).toEqual(expect.arrayContaining(['角色', '用户类型']))
    expect(user.find('fieldset').exists()).toBe(false)

    const admin = open(state({ role: 'VENUE_ADMIN' }))
    expect(labels(admin)).not.toContain('用户类型')
    expect(admin.findAll('fieldset label').map((label) => label.text())).toEqual(['网球馆', '羽毛球馆'])
  })

  it('fixedRole：不显示“角色”选择；勾选场馆发出 patch(venueIds)', async () => {
    const dialog = open(state({ role: 'VENUE_ADMIN' }), { fixedRole: 'VENUE_ADMIN' })

    expect(labels(dialog)).not.toContain('角色')
    await dialog.findAll('fieldset input')[1]?.setValue(true)
    expect(dialog.emitted('patch')).toEqual([[{ venueIds: [2] }]])
  })

  it('切换角色发出 patch(role)', async () => {
    const dialog = open(state())

    await dialog.get('select').setValue('VENUE_ADMIN')

    expect(dialog.emitted('patch')?.[0]).toEqual([{ role: 'VENUE_ADMIN' }])
  })
})

describe('错误与忙碌', () => {
  it('error 显示在对话框里（role=alert）；busy 时“创建”按钮进入加载态', () => {
    const failed = open(state({ error: '用户名已被占用' }))
    expect(failed.get('[role="dialog"] [role="alert"]').text()).toBe('用户名已被占用')

    const busy = open(state({ busy: true }))
    const create = busy.findAll('button')[1]
    expect(create?.attributes('aria-busy')).toBe('true')
    expect(create?.attributes('disabled')).toBeDefined()
  })
})
