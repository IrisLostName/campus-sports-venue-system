// FE-5 P8：操作记录页挂载后的渲染结果（ACC-M2-07 的“操作记录”）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

async function openLogs() {
  return openAdminApp('/venue-admin/logs', {
    prepare: async (h) => {
      const admin = await h.clientFor('admin_tennis')
      await admin.adminCancelReservation(1, { reason: '场地维修' })
      await admin.adminUpdateResource(4, { operationalStatus: 'MAINTENANCE' })
    },
  })
}

describe('P8 操作记录页', () => {
  it('显示时间、操作人、动作、对象、原因，时间倒序', async () => {
    const { root } = await openLogs()
    const main = content(root)

    expect(main.get('h1').text()).toBe('操作记录')
    expect(main.findAll('thead th').map((th) => th.text())).toEqual(['时间', '操作人', '动作', '对象', '原因', '详情'])
    expect(main.findAll('tbody tr').map((row) => row.findAll('td').slice(0, 5).map((td) => td.text()))).toEqual([
      ['2026-10-12 09:00', '网球馆管理员', '变更场地状态', '场地 #4', '—'],
      ['2026-10-12 09:00', '网球馆管理员', '取消预约', '预约 #1', '场地维修'],
    ])
    expect(main.get('.status').text()).toBe('第 1 / 1 页 · 共 2 条')
  })

  it('变更前 / 变更后是可展开的格式化 JSON', async () => {
    const { root } = await openLogs()
    const detail = content(root).findAll('tbody tr')[1]?.get('details')

    expect(detail?.get('summary').text()).toBe('查看详情')
    expect(detail?.get('pre.before').text()).toContain('"status": "CONFIRMED"')
    expect(detail?.get('pre.after').text()).toContain('"status": "ADMIN_CANCELLED"')
    expect(detail?.get('pre.after').text()).toContain('"affectedReservationIds": [\n    1\n  ]')
  })

  it('选择动作后点“查询”：只显示该动作的记录', async () => {
    const { root } = await openLogs()
    const main = content(root)
    await main.get('select').setValue('RESERVATION_CANCEL')
    await buttonIn(main, '查询').trigger('submit')
    await flushPromises()

    expect(main.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text())).toEqual(['取消预约'])
  })

  it('没有符合条件的记录：显示空状态', async () => {
    const { root } = await openLogs()
    const main = content(root)
    await main.get('select').setValue('CLOSURE_ADD')
    await buttonIn(main, '查询').trigger('submit')
    await flushPromises()

    expect(main.find('table').exists()).toBe(false)
    expect(main.get('.ui-empty-state .title').text()).toBe('没有符合条件的操作记录')
  })
})
