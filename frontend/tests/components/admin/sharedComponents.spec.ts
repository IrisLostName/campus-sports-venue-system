// FE-5 共用组件：AdminDataTable、AdminPagination、AdminActionDialog、AdminPage、AdminVenueSelect。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AdminActionDialog from '../../../src/components/admin/AdminActionDialog.vue'
import AdminDataTable from '../../../src/components/admin/AdminDataTable.vue'
import AdminPage from '../../../src/components/admin/AdminPage.vue'
import AdminPagination from '../../../src/components/admin/AdminPagination.vue'
import AdminVenueSelect from '../../../src/components/admin/AdminVenueSelect.vue'
import type { VenueSummary } from '../../../src/api/types'
import { buttonIn } from './support'

interface Row { id: number; name: string; note: string | null }
const COLUMNS = [
  { key: 'name', label: '名称' },
  { key: 'note', label: '备注' },
  { key: 'ops', label: '操作', align: 'end' as const },
]
const ROWS: Row[] = [{ id: 1, name: '甲', note: null }, { id: 2, name: '乙', note: '说明' }]

describe('AdminDataTable', () => {
  it('渲染表头、行；空值显示“—”；实色表面', () => {
    const table = mount(AdminDataTable<Row>, { props: { columns: COLUMNS, rows: ROWS, rowKey: 'id', caption: '示例', emptyTitle: '没有数据' } })

    expect(table.findAll('th').map((th) => th.text())).toEqual(['名称', '备注', '操作'])
    expect(table.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))).toEqual([['甲', '—', '—'], ['乙', '说明', '—']])
    expect(table.get('caption').text()).toBe('示例')
    expect(table.classes()).toContain('ui-glass-card--solid')
    expect(table.findAll('th')[2]?.classes()).toContain('end')
  })

  it('cell-<key> 插槽自定义单元格，参数含整行', () => {
    const table = mount(AdminDataTable<Row>, {
      props: { columns: COLUMNS, rows: ROWS, rowKey: 'id', caption: '示例', emptyTitle: '没有数据' },
      slots: { 'cell-ops': '<template #cell-ops="{ row }"><button>删除{{ row.name }}</button></template>' },
    })

    expect(table.findAll('tbody button').map((button) => button.text())).toEqual(['删除甲', '删除乙'])
  })

  it('没有行：显示空状态，不渲染表格', () => {
    const table = mount(AdminDataTable<Row>, { props: { columns: COLUMNS, rows: [], rowKey: 'id', caption: '示例', emptyTitle: '没有数据' } })

    expect(table.find('table').exists()).toBe(false)
    expect(table.get('.ui-empty-state .title').text()).toBe('没有数据')
  })
})

describe('AdminPagination', () => {
  it('显示页码与总数；首页不能上一页，末页不能下一页', async () => {
    const first = mount(AdminPagination, { props: { page: 1, pageSize: 20, total: 45 } })
    expect(first.get('.status').text()).toBe('第 1 / 3 页 · 共 45 条')
    expect(buttonIn(first, '上一页').attributes('disabled')).toBeDefined()
    await buttonIn(first, '下一页').trigger('click')
    expect(first.emitted('change')).toEqual([[2]])

    const last = mount(AdminPagination, { props: { page: 3, pageSize: 20, total: 45 } })
    expect(buttonIn(last, '下一页').attributes('disabled')).toBeDefined()
    await buttonIn(last, '上一页').trigger('click')
    expect(last.emitted('change')).toEqual([[2]])
  })

  it('没有数据时仍是第 1 / 1 页', () => {
    expect(mount(AdminPagination, { props: { page: 1, pageSize: 20, total: 0 } }).get('.status').text()).toBe('第 1 / 1 页 · 共 0 条')
  })
})

describe('AdminActionDialog', () => {
  it('打开时显示标题、正文、错误和两个按钮；确认与取消发出事件', async () => {
    const dialog = mount(AdminActionDialog, {
      props: { open: true, title: '确认归档？', confirmLabel: '归档', error: '出错了' },
      slots: { default: '<p class="inner">正文</p>' },
    })

    expect(dialog.get('[role="dialog"] h2').text()).toBe('确认归档？')
    expect(dialog.get('.inner').text()).toBe('正文')
    expect(dialog.get('[role="alert"]').text()).toBe('出错了')
    await buttonIn(dialog, '归档').trigger('click')
    await buttonIn(dialog, '取消').trigger('click')
    expect(dialog.emitted('confirm')).toHaveLength(1)
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

  it('关闭时什么都不渲染；busy 时确认按钮不可用', () => {
    expect(mount(AdminActionDialog, { props: { open: false, title: 't', confirmLabel: '好' } }).find('[role="dialog"]').exists()).toBe(false)
    const busy = mount(AdminActionDialog, { props: { open: true, title: 't', confirmLabel: '好', busy: true } })
    expect(buttonIn(busy, '好').attributes('disabled')).toBeDefined()
  })

  it('FE-8 F1 busy（提交中）时“取消”按钮不可用且不发出 dismiss；不忙时可用并发出', async () => {
    const dialog = mount(AdminActionDialog, { props: { open: true, title: 't', confirmLabel: '好', busy: true } })

    expect(buttonIn(dialog, '取消').attributes('disabled')).toBeDefined()
    await buttonIn(dialog, '取消').trigger('click')
    expect(dialog.emitted('dismiss')).toBeUndefined()
    await dialog.setProps({ busy: false })
    expect(buttonIn(dialog, '取消').attributes('disabled')).toBeUndefined()
    await buttonIn(dialog, '取消').trigger('click')
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

  it('FE-8 L5 Esc 关闭对话框；busy（提交中）时 Esc 不关闭', async () => {
    const dialog = mount(AdminActionDialog, { props: { open: true, title: 't', confirmLabel: '好', busy: true } })
    const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    press()
    expect(dialog.emitted('dismiss')).toBeUndefined()
    await dialog.setProps({ busy: false })
    press()
    expect(dialog.emitted('dismiss')).toHaveLength(1)
    dialog.unmount()
  })
})

describe('AdminPage', () => {
  it('标题、操作区、错误（alert）与成功提示（status）', () => {
    const page = mount(AdminPage, {
      props: { title: '示例页', error: '失败了', notice: '已完成' },
      slots: { actions: '<button>新建</button>', default: '<p class="x">内容</p>' },
    })

    expect(page.get('h1').text()).toBe('示例页')
    expect(page.get('.actions button').text()).toBe('新建')
    expect(page.get('[role="alert"]').text()).toBe('失败了')
    expect(page.get('[role="status"]').text()).toBe('已完成')
    expect(page.get('.x').text()).toBe('内容')
  })

  it('没有错误与提示时不渲染横幅', () => {
    const page = mount(AdminPage, { props: { title: '示例页', error: null, notice: null } })

    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.find('[role="status"]').exists()).toBe(false)
  })
})

function venue(id: number, name: string): VenueSummary {
  return {
    id, name, venueType: 'OTHER', location: null, description: null,
    operationalStatus: 'OPEN', userBookingEnabled: false, bookable: false, resourceCount: 0,
  }
}

describe('AdminVenueSelect', () => {
  it('选项就是传入的场馆，当前场馆被选中；改选发出 select（数字）', async () => {
    const select = mount(AdminVenueSelect, { props: { venues: [venue(2, '羽毛球馆'), venue(3, '游泳馆')], venueId: 3 } })

    expect(select.findAll('option').map((option) => option.text())).toEqual(['羽毛球馆', '游泳馆'])
    expect((select.get('select').element as HTMLSelectElement).value).toBe('3')
    await select.get('select').setValue('2')
    expect(select.emitted('select')).toEqual([[2]])
  })
})
