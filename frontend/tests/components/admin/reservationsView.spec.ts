// FE-5 P2：预约管理页挂载后的渲染结果（ACC-M2-07 的“预约管理”：取消、改派场地、改派人员）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import type { Reservation } from '../../../src/api/types'
import { deferred } from '../../display/support'
import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

function rowOf(main: ReturnType<typeof content>, name: string) {
  const row = main.findAll('tbody tr').find((item) => item.text().includes(name))
  if (row === undefined) {
    throw new Error(`找不到 ${name} 的预约行`)
  }
  return row
}

describe('P2 预约列表', () => {
  it('显示日期、时间、场地、预约人（含用户名）、状态与三个操作按钮', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)

    expect(main.get('h1').text()).toBe('预约管理')
    expect(main.findAll('thead th').map((th) => th.text())).toEqual(['日期', '时间', '场地', '预约人', '状态', '管理员说明', '操作'])
    expect(main.findAll('tbody tr')).toHaveLength(2)
    const row = rowOf(main, '张三')
    expect(row.findAll('td').map((td) => td.text()).slice(0, 5)).toEqual(['2026-10-13', '08:00–09:30', '网球场1', '张三zhangsan', '待使用'])
    expect(row.findAll('button').map((button) => button.text())).toEqual(['取消', '改派场地', '改派人员'])
    expect(main.get('.status').text()).toBe('第 1 / 1 页 · 共 2 条')
  })

  it('关键字筛选后只剩匹配的预约；无匹配时显示空状态', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)
    await main.get('input[placeholder]').setValue('李四')
    await buttonIn(main, '查询').trigger('submit')
    await flushPromises()
    expect(main.findAll('tbody tr').map((row) => row.findAll('td')[3]?.text())).toEqual(['李四lisi'])

    await main.get('input[placeholder]').setValue('不存在的人')
    await buttonIn(main, '查询').trigger('submit')
    await flushPromises()
    expect(main.get('.ui-empty-state .title').text()).toBe('没有符合条件的预约')
  })

  it('已签到的预约只有“取消”，没有改派按钮；已结束的没有任何操作（X6：只依据后端字段）', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations', {
      wrap: (api) => ({
        ...api,
        adminListReservations: async (query) => {
          const page = await api.adminListReservations(query)
          return {
            ...page,
            items: page.items.map((item) => (item.id === 1
              ? { ...item, checkInAt: '2026-10-13T07:50:00', displayStatus: 'IN_USE' as const }
              : { ...item, displayStatus: 'COMPLETED' as const })),
          }
        },
      }),
    })
    const main = content(root)

    expect(rowOf(main, '张三').findAll('button').map((button) => button.text())).toEqual(['取消'])
    expect(rowOf(main, '李四').findAll('button')).toHaveLength(0)
    expect(rowOf(main, '张三').text()).toContain('使用中')
  })
})

describe('P2 取消', () => {
  it('原因必填；填写后取消，列表显示“管理员已取消”和说明，按钮消失', async () => {
    const { root, h } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)
    await buttonIn(rowOf(main, '张三'), '取消').trigger('click')

    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('取消预约')
    expect(dialog.get('p.summary').text()).toBe('网球馆 · 网球场1 · 2026-10-13 08:00–09:30 · 张三')
    await buttonIn(dialog, '确认取消').trigger('click')
    expect(dialog.get('[role="alert"]').text()).toBe('请填写原因')

    await dialog.get('textarea').setValue('场地检修')
    await buttonIn(dialog, '确认取消').trigger('click')
    await flushPromises()

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(main.get('[role="status"]').text()).toBe('预约已取消')
    const row = rowOf(main, '张三')
    expect(row.findAll('td').map((td) => td.text()).slice(4, 6)).toEqual(['管理员已取消', '场地检修'])
    expect(row.findAll('button')).toHaveLength(0)
    expect((await (await h.clientFor('zhangsan')).getReservation(1)).adminNote).toBe('场地检修')
  })

  it('FE-8 L5 Esc 关闭取消对话框且不发请求；提交进行中 Esc 不关闭，完成后才关闭', async () => {
    const pending = deferred<Reservation>()
    let cancelCalls = 0
    const { root, h } = await openAdminApp('/venue-admin/reservations', {
      wrap: (api) => ({
        ...api,
        adminCancelReservation: (...args) => {
          cancelCalls += 1
          return cancelCalls === 1 ? pending.promise : api.adminCancelReservation(...args)
        },
      }),
    })
    const main = content(root)
    const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await buttonIn(rowOf(main, '张三'), '取消').trigger('click')
    expect(main.find('[role="dialog"]').exists()).toBe(true)

    press()
    await flushPromises()
    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(cancelCalls).toBe(0)

    await buttonIn(rowOf(main, '张三'), '取消').trigger('click')
    await main.get('[role="dialog"] textarea').setValue('场地检修')
    await buttonIn(main.get('[role="dialog"]'), '确认取消').trigger('click')
    expect(cancelCalls).toBe(1)
    press()
    await flushPromises()
    expect(main.find('[role="dialog"]').exists()).toBe(true)

    pending.resolve(await (await h.clientFor('zhangsan')).getReservation(1))
    await flushPromises()
    expect(main.find('[role="dialog"]').exists()).toBe(false)
  })

  it('后端拒绝（FORBIDDEN_SCOPE）：对话框保持并显示文案', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations', {
      wrap: (api) => ({ ...api, adminCancelReservation: () => Promise.reject(new ApiError(403, 'FORBIDDEN_SCOPE', 'x')) }),
    })
    const main = content(root)
    await buttonIn(rowOf(main, '张三'), '取消').trigger('click')
    const dialog = main.get('[role="dialog"]')
    await dialog.get('textarea').setValue('原因')
    await buttonIn(dialog, '确认取消').trigger('click')
    await flushPromises()

    expect(dialog.get('[role="alert"]').text()).toBe('无权操作该场馆')
    await buttonIn(dialog, '取消').trigger('click')
    expect(main.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('P2 改派', () => {
  it('改派场地：选目标场地与时间（只列空闲格子）、填原因，列表显示新场地', async () => {
    const { root, h } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)
    await buttonIn(rowOf(main, '张三'), '改派场地').trigger('click')
    await flushPromises()

    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('改派场地')
    const [resourceSelect, timeSelect] = dialog.findAll('select')
    expect(resourceSelect?.findAll('option').map((option) => option.text())).toEqual(['请选择', '网球场1', '网球场2', '网球场3', '网球场4'])

    await resourceSelect?.setValue('1')
    expect(timeSelect?.findAll('option').map((option) => option.text())).not.toContain('08:00–09:30')

    await buttonIn(dialog, '确认改派').trigger('click')
    expect(dialog.get('[role="alert"]').text()).toBe('请选择开始时间')

    await resourceSelect?.setValue('3')
    await timeSelect?.setValue('11:00')
    await dialog.get('textarea').setValue('球场翻新')
    await buttonIn(dialog, '确认改派').trigger('click')
    await flushPromises()

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(main.get('[role="status"]').text()).toBe('已改派场地')
    expect(rowOf(main, '张三').findAll('td').map((td) => td.text()).slice(1, 3)).toEqual(['11:00–12:30', '网球场3'])
    expect((await h.api.getReservation(1)).resourceName).toBe('网球场3')
  })

  it('改派场地：换成 7 天以外的日期仍可改派', async () => {
    const { root, h } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)
    await buttonIn(rowOf(main, '张三'), '改派场地').trigger('click')
    await flushPromises()
    const dialog = main.get('[role="dialog"]')
    await dialog.get('input[type="date"]').setValue('2026-11-16')
    await flushPromises()
    const [resourceSelect, timeSelect] = dialog.findAll('select')
    await resourceSelect?.setValue('2')
    await timeSelect?.setValue('08:00')
    await dialog.get('textarea').setValue('延期')
    await buttonIn(dialog, '确认改派').trigger('click')
    await flushPromises()

    expect((await h.api.getReservation(1)).serviceDate).toBe('2026-11-16')
  })

  it('改派人员：输入目标用户 ID 与原因，列表显示新预约人；ID 无效时提示', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations')
    const main = content(root)
    await buttonIn(rowOf(main, '张三'), '改派人员').trigger('click')
    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('改派预约人')
    expect(dialog.get('.hint').text()).toContain('场馆管理员无法查询用户列表')

    await buttonIn(dialog, '确认改派').trigger('click')
    expect(dialog.get('[role="alert"]').text()).toBe('请输入有效的用户 ID（正整数）')

    await dialog.get('input').setValue('3')
    await dialog.get('textarea').setValue('本人委托')
    await buttonIn(dialog, '确认改派').trigger('click')
    await flushPromises()

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(main.get('[role="status"]').text()).toBe('已改派预约人')
    expect(main.findAll('tbody tr').some((row) => row.text().includes('王五'))).toBe(true)
  })
})
