// FE-6 G4 / G5（ACC-M2-08）：“系统公告”“全局统计”页挂载后的渲染结果与操作。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('G4 系统公告页', () => {
  it('标题、发布表单（标题 ≤100、内容 ≤2000）、状态筛选、系统公告表（生效中的有归档按钮）', async () => {
    const { root } = await openSysApp('/sys-admin/announcements')
    const main = content(root)
    const form = main.get('form[aria-label="发布系统公告"]')

    expect(main.get('h1').text()).toBe('系统公告')
    expect(form.get('h2').text()).toBe('发布系统公告')
    expect(fieldByLabel(form, '标题').attributes('maxlength')).toBe('100')
    expect(fieldByLabel(form, '内容').attributes('maxlength')).toBe('2000')
    expect(main.findAll('[aria-label="按状态筛选"] button').map((button) => button.text())).toEqual(['全部', '生效中', '已归档'])
    expect(main.findAll('tbody tr').map((row) => row.findAll('td').map((td) => td.text()).slice(0, 5))).toEqual([
      ['欢迎使用校园场馆预约系统', '欢迎使用校园场馆预约系统', '生效中', '2026-10-12 09:00', '系统管理员'],
    ])
    expect(buttonIn(main.get('tbody tr'), '归档').exists()).toBe(true)
  })

  it('发布：标题 / 内容为空时提示；发布后表单清空、新公告出现、用户端可见（演示：发布系统公告）', async () => {
    const { root, h } = await openSysApp('/sys-admin/announcements')
    const form = () => content(root).get('form[aria-label="发布系统公告"]')
    await buttonIn(form(), '发布').trigger('submit')
    await flushPromises()
    expect(form().get('[role="alert"]').text()).toBe('请填写标题')

    await fieldByLabel(form(), '标题').setValue('国庆开放时间')
    await buttonIn(form(), '发布').trigger('submit')
    await flushPromises()
    expect(form().get('[role="alert"]').text()).toBe('请填写内容')

    await fieldByLabel(form(), '内容').setValue('假期照常开放')
    await buttonIn(form(), '发布').trigger('submit')
    await flushPromises()

    expect(content(root).get('[role="status"]').text()).toBe('公告已发布')
    expect((fieldByLabel(form(), '标题').element as HTMLInputElement).value).toBe('')
    expect(content(root).findAll('tbody tr').map((row) => row.findAll('td')[0]?.text())).toContain('国庆开放时间')
    const zhangsan = await h.clientFor('zhangsan')
    expect((await zhangsan.listAnnouncements({ scope: 'SYSTEM' })).map((item) => item.title)).toContain('国庆开放时间')
  })

  it('归档：先确认；确认后用户端不再显示，列表里变为“已归档”且没有归档按钮；“已归档”筛选只剩它', async () => {
    const { root, h } = await openSysApp('/sys-admin/announcements')
    await buttonIn(content(root).get('tbody tr'), '归档').trigger('click')
    const dialog = () => content(root).get('[role="dialog"]')
    expect(dialog().get('h2').text()).toBe('确认归档公告？')
    expect(dialog().text()).toContain('归档后用户端不再显示：欢迎使用校园场馆预约系统')

    await buttonIn(dialog(), '归档').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('公告已归档')
    expect(content(root).get('tbody tr').findAll('td')[2]?.text()).toBe('已归档')
    expect(content(root).get('tbody tr').findAll('button')).toHaveLength(0)
    const zhangsan = await h.clientFor('zhangsan')
    expect(await zhangsan.listAnnouncements({ scope: 'SYSTEM' })).toEqual([])

    await content(root).findAll('[aria-label="按状态筛选"] button')[1]?.trigger('click')
    await flushPromises()
    expect(content(root).find('tbody').exists()).toBe(false)
    expect(content(root).text()).toContain('暂无系统公告')
  })
})

describe('G5 全局统计页', () => {
  it('八项指标、分场馆（byVenue）三行、每日趋势 7 行，全部来自接口', async () => {
    const { root } = await openSysApp('/sys-admin/stats')
    const main = content(root)

    expect(main.get('h1').text()).toBe('全局统计')
    expect(main.findAll('[data-metric]').map((node) => node.attributes('data-metric'))).toEqual([
      'reservationCount', 'activeOccupiedSlots', 'openSlots', 'utilizationRate', 'currentInUse', 'userCancelCount', 'adminCancelCount', 'noShowRate',
    ])
    expect(main.get('[data-metric="noShowRate"]').text()).toContain('—')
    expect(main.get('section[aria-label="指标"] .range').text()).toBe('统计区间：2026-10-06 至 2026-10-12')
    expect(main.findAll('section[aria-label="分场馆统计"] tbody tr').map((row) => row.findAll('td')[0]?.text())).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(main.findAll('section[aria-label="分场馆统计"] th').map((th) => th.text())).toEqual(['场馆', '预约量', '利用率'])
    expect(main.findAll('section[aria-label="每日趋势"] tbody tr')).toHaveLength(7)
  })

  it('不重新计算：各场馆预约量取自接口 byVenue，分母为 0 的利用率显示“—”', async () => {
    const { root } = await openSysApp('/sys-admin/stats', {
      wrap: (api) => ({
        ...api,
        adminGetStatsOverview: async (query) => {
          const stats = await api.adminGetStatsOverview(query)
          return {
            ...stats,
            reservationCount: 100,
            byVenue: [
              { venueId: 1, venueName: '网球馆', reservationCount: 6, utilizationRate: 0.3333 },
              { venueId: 2, venueName: '羽毛球馆', reservationCount: 3, utilizationRate: null },
            ],
          }
        },
      }),
    })
    const main = content(root)

    expect(main.get('[data-metric="reservationCount"]').text()).toContain('100')
    expect(main.findAll('section[aria-label="分场馆统计"] tbody tr').map((row) => row.findAll('td').map((td) => td.text()))).toEqual([
      ['网球馆', '6', '33.3%'], ['羽毛球馆', '3', '—'],
    ])
  })

  it('选择日期区间后点“查询”：统计区间随之改变；区间不合法时显示接口文案', async () => {
    const { root } = await openSysApp('/sys-admin/stats')
    await fieldByLabel(content(root), '起始日期').setValue('2026-10-10')
    await fieldByLabel(content(root), '截止日期').setValue('2026-10-12')
    await buttonIn(content(root), '查询').trigger('submit')
    await flushPromises()
    expect(content(root).get('section[aria-label="指标"] .range').text()).toBe('统计区间：2026-10-10 至 2026-10-12')
    expect(content(root).findAll('section[aria-label="每日趋势"] tbody tr')).toHaveLength(3)

    await fieldByLabel(content(root), '起始日期').setValue('2020-01-01')
    await buttonIn(content(root), '查询').trigger('submit')
    await flushPromises()
    expect(content(root).get('[role="alert"]').text()).toBe('请求参数不合法')
  })
})
