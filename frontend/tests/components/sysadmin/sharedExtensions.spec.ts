// FE-6 对 FE-5 共用组件的可选属性扩展（X7）：不传新属性时与 FE-5 完全一致，传了才有新行为。
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { VenueSummary } from '../../../src/api/types'
import AdminShell from '../../../src/components/admin/AdminShell.vue'
import AdminVenueSelect from '../../../src/components/admin/AdminVenueSelect.vue'
import AnnouncementForm from '../../../src/components/admin/announcements/AnnouncementForm.vue'
import LogTable from '../../../src/components/admin/logs/LogTable.vue'
import StatsByVenue from '../../../src/components/sys-admin/stats/StatsByVenue.vue'
import VenueCheckList from '../../../src/components/sys-admin/users/VenueCheckList.vue'
import type { AdminNavItem } from '../../../src/utils/adminNav'
import type { LogRowView } from '../../../src/utils/adminLogDisplay'
import { createAuthHarness, DEMO_PASSWORD } from '../../auth/harness'

async function mountShell(items: AdminNavItem[]) {
  const h = createAuthHarness()
  await h.auth.login({ username: 'sysadmin', password: DEMO_PASSWORD })
  await h.router.push('/sys-admin')
  const page = mount(AdminShell, { props: { brand: '系统管理端', items }, global: { plugins: [h.auth._p, h.router] } })
  await flushPromises()
  return page
}

const VENUES = [
  { id: 1, name: '网球馆' }, { id: 2, name: '羽毛球馆' },
] as VenueSummary[]

describe('AdminShell 分组标题', () => {
  it('条目带 group：每个新分组前有一次标题；相邻同组只出现一次', async () => {
    const page = await mountShell([
      { label: 'A', to: '/sys-admin', group: '全局' },
      { label: 'B', to: '/sys-admin/users', group: '全局' },
      { label: 'C', to: '/sys-admin/stats', group: '场馆运营' },
    ])

    expect(page.get('nav').findAll('.group, a').map((node) => node.text())).toEqual(['全局', 'A', 'B', '场馆运营', 'C'])
  })

  it('条目不带 group：没有任何标题，导航与 FE-5 一致', async () => {
    const page = await mountShell([{ label: 'A', to: '/sys-admin' }, { label: 'B', to: '/sys-admin/users' }])

    expect(page.findAll('.group')).toHaveLength(0)
    expect(page.findAll('nav a').map((link) => link.text())).toEqual(['A', 'B'])
  })
})

describe('AdminVenueSelect allowAll', () => {
  it('缺省：只有场馆选项，选择发出 id（FE-5 行为）', async () => {
    const select = mount(AdminVenueSelect, { props: { venues: VENUES, venueId: 1 } })

    expect(select.findAll('option').map((option) => option.text())).toEqual(['网球馆', '羽毛球馆'])
    await select.get('select').setValue('2')
    expect(select.emitted('select')).toEqual([[2]])
  })

  it('allowAll：多一个“全部场馆”，没有选定场馆时选中它；选它发出 null', async () => {
    const select = mount(AdminVenueSelect, { props: { venues: VENUES, venueId: null, allowAll: true } })

    expect(select.findAll('option').map((option) => option.text())).toEqual(['全部场馆', '网球馆', '羽毛球馆'])
    expect((select.get('select').element as HTMLSelectElement).value).toBe('')
    await select.get('select').setValue('1')
    await select.get('select').setValue('')
    expect(select.emitted('select')).toEqual([[1], [null]])
  })
})

describe('LogTable showVenue', () => {
  const row: LogRowView = {
    id: 1, timeText: '10-12 09:00', adminName: '系统管理员', actionLabel: '创建账号', targetText: '用户 #8',
    reasonText: null, before: null, after: '{}', venueText: '全局',
  }

  it('缺省没有场馆列；showVenue 时第一列是场馆', () => {
    const plain = mount(LogTable, { props: { rows: [row] } })
    const withVenue = mount(LogTable, { props: { rows: [row], showVenue: true } })

    expect(plain.findAll('th').map((th) => th.text())).toEqual(['时间', '操作人', '动作', '对象', '原因', '详情'])
    expect(withVenue.findAll('th').map((th) => th.text())).toEqual(['场馆', '时间', '操作人', '动作', '对象', '原因', '详情'])
    expect(withVenue.get('tbody td').text()).toBe('全局')
  })
})

describe('AnnouncementForm heading', () => {
  it('缺省“发布场馆公告”；传入后标题与无障碍名称都变', () => {
    const base = { form: { title: '', content: '', expiresAt: '' }, error: null, busy: false }
    const plain = mount(AnnouncementForm, { props: base })
    const system = mount(AnnouncementForm, { props: { ...base, heading: '发布系统公告' } })

    expect(plain.get('h2').text()).toBe('发布场馆公告')
    expect(plain.attributes('aria-label')).toBe('发布场馆公告')
    expect(system.get('h2').text()).toBe('发布系统公告')
    expect(system.attributes('aria-label')).toBe('发布系统公告')
  })
})

describe('FE-6 新增的小组件', () => {
  it('VenueCheckList：勾选 / 取消勾选发出新的 id 数组', async () => {
    const list = mount(VenueCheckList, { props: { modelValue: [1], venues: VENUES, legend: '授权场馆' } })

    expect(list.get('legend').text()).toBe('授权场馆')
    expect(list.findAll('input').map((input) => (input.element as HTMLInputElement).checked)).toEqual([true, false])
    await list.findAll('input')[1]?.setValue(true)
    await list.findAll('input')[0]?.setValue(false)
    expect(list.emitted('update:modelValue')).toEqual([[[1, 2]], [[2]]])
  })

  it('StatsByVenue：空数据显示空状态', () => {
    const empty = mount(StatsByVenue, { props: { rows: [] } })

    expect(empty.text()).toContain('暂无场馆统计')
  })
})
