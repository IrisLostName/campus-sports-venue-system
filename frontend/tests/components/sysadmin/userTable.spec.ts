// FE-8 L14（FE-6 N3）：UserTable 直接挂载——列、每行的按钮显示规则、忙碌时禁用、事件，以及按钮的可访问名称（L11）。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UserTable from '../../../src/components/sys-admin/users/UserTable.vue'
import type { UserRowView } from '../../../src/utils/sysUserDisplay'

function user(overrides: Partial<UserRowView> = {}): UserRowView {
  return {
    id: 1, username: 'zhangsan', displayName: '张三', roleLabel: '普通用户', statusLabel: '正常', active: true, isSelf: false,
    scopeText: null, isVenueAdmin: false, venueIds: [], ...overrides,
  }
}

const ROWS: UserRowView[] = [
  user(),
  user({ id: 2, username: 'admin_tennis', displayName: '网球馆管理员', roleLabel: '场馆管理员', isVenueAdmin: true, scopeText: '网球馆', venueIds: [1] }),
  user({ id: 3, username: 'sysadmin', displayName: '系统管理员', roleLabel: '系统管理员', isSelf: true }),
  user({ id: 4, username: 'lisi', displayName: '李四', statusLabel: '已停用', active: false }),
]

function mountTable(props: { rows?: UserRowView[]; showScope?: boolean; busy?: boolean } = {}) {
  return mount(UserTable, { props: { rows: ROWS, showScope: false, busy: false, ...props } })
}

const opsOf = (table: ReturnType<typeof mountTable>, index: number) => table.findAll('tbody tr')[index]?.findAll('button').map((button) => button.text())

describe('列与行', () => {
  it('不带授权列：用户名 / 显示名 / 角色 / 账号状态 / 操作；每行文字来自行数据', () => {
    const table = mountTable()

    expect(table.findAll('th').map((th) => th.text())).toEqual(['用户名', '显示名', '角色', '账号状态', '操作'])
    expect(table.findAll('tbody tr')[0]?.findAll('td').map((td) => td.text()).slice(0, 4)).toEqual(['zhangsan', '张三', '普通用户', '正常'])
  })

  it('showScope：多一列“授权场馆”，没有授权范围的显示“—”', () => {
    const table = mountTable({ showScope: true })

    expect(table.findAll('th').map((th) => th.text())).toEqual(['用户名', '显示名', '角色', '账号状态', '授权场馆', '操作'])
    expect(table.findAll('tbody tr').map((tr) => tr.findAll('td')[4]?.text())).toEqual(['—', '网球馆', '—', '—'])
  })

  it('没有账号：显示空状态“没有符合条件的账号”，没有表格', () => {
    const table = mountTable({ rows: [] })

    expect(table.find('table').exists()).toBe(false)
    expect(table.get('.ui-empty-state .title').text()).toBe('没有符合条件的账号')
  })
})

describe('按钮显示规则', () => {
  it('普通用户：改显示名、停用；场馆管理员多一个“调整授权”；自己没有“停用”；已停用的是“启用”而不是“停用”', () => {
    const table = mountTable()

    expect(opsOf(table, 0)).toEqual(['改显示名', '停用'])
    expect(opsOf(table, 1)).toEqual(['改显示名', '调整授权', '停用'])
    expect(opsOf(table, 2)).toEqual(['改显示名'])
    expect(opsOf(table, 3)).toEqual(['改显示名', '启用'])
  })

  it('busy：停用与启用不可点，改显示名与调整授权仍可点', () => {
    const table = mountTable({ busy: true })
    const disabled = table.findAll('tbody button').map((button) => [button.text(), button.attributes('disabled') !== undefined])

    expect(disabled).toEqual([
      ['改显示名', false], ['停用', true],
      ['改显示名', false], ['调整授权', false], ['停用', true],
      ['改显示名', false],
      ['改显示名', false], ['启用', true],
    ])
  })
})

describe('事件与可访问名称', () => {
  it('四种按钮各发出带账号 id 的事件', async () => {
    const table = mountTable()
    const click = (row: number, label: string) => table.findAll('tbody tr')[row]?.findAll('button').find((button) => button.text() === label)?.trigger('click')

    await click(0, '改显示名')
    await click(1, '调整授权')
    await click(0, '停用')
    await click(3, '启用')

    expect(table.emitted('rename')).toEqual([[1]])
    expect(table.emitted('scope')).toEqual([[2]])
    expect(table.emitted('disable')).toEqual([[1]])
    expect(table.emitted('enable')).toEqual([[4]])
  })

  it('按钮的 aria-label 以可见文字开头并带用户名，同一张表里互不重名', () => {
    const table = mountTable()
    const names = table.findAll('tbody button').map((button) => button.attributes('aria-label'))

    expect(names).toEqual([
      '改显示名：zhangsan', '停用：zhangsan',
      '改显示名：admin_tennis', '调整授权：admin_tennis', '停用：admin_tennis',
      '改显示名：sysadmin',
      '改显示名：lisi', '启用：lisi',
    ])
    expect(new Set(names).size).toBe(names.length)
  })
})
