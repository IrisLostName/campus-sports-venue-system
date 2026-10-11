// FE-8 L7 / L11 / L14：VenueTable 直接挂载——行内容、开关、按钮与事件、可访问名称，以及“场馆已关闭，用户端不可预约”的说明。
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import VenueTable from '../../../src/components/sys-admin/venues/VenueTable.vue'
import type { VenueRowView } from '../../../src/utils/sysVenueDisplay'

function row(overrides: Partial<VenueRowView> = {}): VenueRowView {
  return {
    id: 1, name: '网球馆', typeLabel: '网球', locationText: null, statusLabel: '开放', open: true,
    bookingEnabled: true, bookingHint: null, resourceCount: 4, ...overrides,
  }
}

function mountTable(rows: VenueRowView[], busy = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
  return mount(VenueTable, { props: { rows, busy }, global: { plugins: [router] } })
}

describe('L7 关闭但开关仍开的场馆', () => {
  it('bookingHint 非空：开关那一格显示说明，开关仍是“已开放”；为空则不渲染说明', () => {
    const table = mountTable([
      row({ id: 1, open: false, statusLabel: '已关闭', bookingHint: '场馆已关闭，用户端不可预约' }),
      row({ id: 2, name: '游泳馆', open: false, statusLabel: '已关闭', bookingEnabled: false }),
    ])
    const cells = table.findAll('tbody tr').map((tr) => tr.findAll('td')[4])

    expect(cells[0]?.get('.switch').text()).toBe('已开放')
    expect((cells[0]?.get('input[role="switch"]').element as HTMLInputElement).checked).toBe(true)
    expect(cells[0]?.get('.booking-hint').text()).toBe('场馆已关闭，用户端不可预约')
    expect(cells[1]?.text()).toBe('未开放')
    expect(cells[1]?.find('.booking-hint').exists()).toBe(false)
  })
})

describe('L14 列、按钮与事件', () => {
  const ROWS = [
    row(),
    row({ id: 2, name: '羽毛球馆', typeLabel: '羽毛球', locationText: '东区', bookingEnabled: false, resourceCount: 6 }),
    row({ id: 3, name: '游泳馆', typeLabel: '游泳', open: false, statusLabel: '已关闭', bookingEnabled: false, resourceCount: 6 }),
  ]

  it('七列；位置为空显示“—”；场地数靠右；空列表显示“还没有场馆”', () => {
    const table = mountTable(ROWS)
    const plainCells = table.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()).filter((_text, index) => index !== 4 && index !== 6))

    expect(table.findAll('th').map((th) => th.text())).toEqual(['名称', '类型', '位置', '运营状态', '对用户开放预约', '场地数', '操作'])
    expect(plainCells).toEqual([['网球馆', '网球', '—', '开放', '4'], ['羽毛球馆', '羽毛球', '东区', '开放', '6'], ['游泳馆', '游泳', '—', '已关闭', '6']])
    expect(table.findAll('tbody tr')[0]?.findAll('td')[5]?.classes()).toContain('end')
    expect(mountTable([]).get('.ui-empty-state .title').text()).toBe('还没有场馆')
  })

  it('开放的场馆有“关闭场馆”，已关闭的有“重新开放”；每行都有“编辑资料”和指向场地页的链接', () => {
    const table = mountTable(ROWS)
    const ops = table.findAll('tbody tr').map((tr) => tr.findAll('button, a').map((node) => node.text()))

    expect(ops).toEqual([
      ['编辑资料', '场地与开放规则', '关闭场馆'],
      ['编辑资料', '场地与开放规则', '关闭场馆'],
      ['编辑资料', '场地与开放规则', '重新开放'],
    ])
    expect(table.findAll('tbody a').map((link) => link.attributes('href'))).toEqual([
      '/sys-admin/resources?venueId=1', '/sys-admin/resources?venueId=2', '/sys-admin/resources?venueId=3',
    ])
  })

  it('开关：点击发出 toggle(id, 新值) 并先把控件还原；busy 时所有开关不可用', async () => {
    const table = mountTable(ROWS)
    const switches = table.findAll('input[role="switch"]')

    expect(switches.map((node) => (node.element as HTMLInputElement).checked)).toEqual([true, false, false])
    await switches[1]?.setValue(true)
    await switches[0]?.setValue(false)
    expect(table.emitted('toggle')).toEqual([[2, true], [1, false]])
    expect(switches.map((node) => (node.element as HTMLInputElement).checked)).toEqual([true, false, false])
    expect(mountTable(ROWS, true).findAll('input[role="switch"]').every((node) => node.attributes('disabled') !== undefined)).toBe(true)
  })

  it('三个按钮发出带场馆 id 的事件', async () => {
    const table = mountTable(ROWS)
    const click = (index: number, label: string) => table.findAll('tbody tr')[index]?.findAll('button').find((button) => button.text() === label)?.trigger('click')

    await click(0, '编辑资料')
    await click(1, '关闭场馆')
    await click(2, '重新开放')

    expect(table.emitted('edit')).toEqual([[1]])
    expect(table.emitted('close')).toEqual([[2]])
    expect(table.emitted('reopen')).toEqual([[3]])
  })
})

describe('L11 可访问名称', () => {
  it('每行的按钮与链接以可见文字开头并带场馆名；开关带“对用户开放预约：场馆名”', () => {
    const table = mountTable([row(), row({ id: 2, name: '游泳馆', open: false })])

    expect(table.findAll('tbody tr').map((tr) => tr.findAll('button, a').map((node) => node.attributes('aria-label')))).toEqual([
      ['编辑资料：网球馆', '场地与开放规则：网球馆', '关闭场馆：网球馆'],
      ['编辑资料：游泳馆', '场地与开放规则：游泳馆', '重新开放：游泳馆'],
    ])
    expect(table.findAll('input[role="switch"]').map((node) => node.attributes('aria-label'))).toEqual([
      '对用户开放预约：网球馆', '对用户开放预约：游泳馆',
    ])
  })
})
