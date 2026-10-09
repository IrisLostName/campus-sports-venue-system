// FE-5 P6：公告页挂载后的渲染结果（ACC-M2-07 的“公告”；演示：发布并归档一条场馆公告）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('P6 公告页', () => {
  it('分为场馆公告与只读的系统公告；系统公告没有归档按钮', async () => {
    const { root } = await openAdminApp('/venue-admin/announcements')
    const main = content(root)

    expect(main.get('h1').text()).toBe('公告')
    expect(main.findAll('section[aria-label] h2').map((h2) => h2.text())).toEqual(['场馆公告', '系统公告（只读）'])
    const venue = main.get('section[aria-label="场馆公告"]')
    expect(venue.findAll('tbody tr')).toHaveLength(1)
    expect(venue.findAll('tbody button').map((button) => button.text())).toEqual(['归档'])
    const system = main.get('section[aria-label="系统公告"]')
    expect(system.get('tbody tr td').text()).toBe('欢迎使用校园场馆预约系统')
    expect(system.findAll('tbody button')).toHaveLength(0)
  })

  it('发布：标题 / 内容为空显示提示；填写后发布，新公告出现在列表最前', async () => {
    const { root } = await openAdminApp('/venue-admin/announcements')
    const main = content(root)
    const form = main.get('form')

    await buttonIn(form, '发布').trigger('submit')
    expect(form.get('[role="alert"]').text()).toBe('请填写标题')

    await form.get('input').setValue('临时闭馆')
    await form.get('textarea').setValue('周三全天检修')
    expect(form.get('input').attributes('maxlength')).toBe('100')
    expect(form.get('textarea').attributes('maxlength')).toBe('2000')
    await buttonIn(form, '发布').trigger('submit')
    await flushPromises()

    expect(main.get('[role="status"]').text()).toBe('公告已发布')
    const rows = main.get('section[aria-label="场馆公告"]').findAll('tbody tr')
    expect(rows.map((row) => row.findAll('td')[0]?.text())).toEqual(['临时闭馆', '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
    expect((form.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('归档：确认对话框 → 归档后状态变为已归档且不再有归档按钮；筛选“已归档”能看到', async () => {
    const { root } = await openAdminApp('/venue-admin/announcements')
    const main = content(root)
    const venue = main.get('section[aria-label="场馆公告"]')

    await buttonIn(venue, '归档').trigger('click')
    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('确认归档公告？')
    await buttonIn(dialog, '取消').trigger('click')
    expect(main.find('[role="dialog"]').exists()).toBe(false)

    await buttonIn(venue, '归档').trigger('click')
    await buttonIn(main.get('[role="dialog"]'), '归档').trigger('click')
    await flushPromises()

    expect(main.get('[role="status"]').text()).toBe('公告已归档')
    expect(venue.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text())).toEqual(['已归档'])
    expect(venue.findAll('tbody button')).toHaveLength(0)

    await buttonIn(main.get('.ui-segmented'), '生效中').trigger('click')
    await flushPromises()
    expect(venue.find('table').exists()).toBe(false)
    await buttonIn(main.get('.ui-segmented'), '已归档').trigger('click')
    await flushPromises()
    expect(venue.findAll('tbody tr')).toHaveLength(1)
  })
})
