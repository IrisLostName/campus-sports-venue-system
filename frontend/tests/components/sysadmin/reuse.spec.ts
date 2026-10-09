// FE-6 S2 / S4 / G6 / G7：FE-5 的页面不复制，直接挂在 /sys-admin 下，以系统管理员的场馆选择器为上下文。
// 预约管理与操作记录多一个“全部场馆”；演示主线第 6 步：新增场馆后在“场地与开放规则”设定泳道和每周开放窗口。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('G7 预约管理：全部场馆', () => {
  it('缺省“全部场馆”：两个网球馆预约的场地列带场馆名；切到网球馆后去掉场馆名；切到羽毛球馆为空', async () => {
    const { root, router } = await openSysApp('/sys-admin/reservations')
    const places = () => content(root).findAll('tbody tr').map((row) => row.findAll('td')[2]?.text()).sort()

    expect(content(root).get('h1').text()).toBe('预约管理')
    expect(places()).toEqual(['网球馆 · 网球场1', '网球馆 · 网球场2'])

    await fieldByLabel(root.get('header'), '场馆').setValue('1')
    await flushPromises()
    expect(router.currentRoute.value.query.venueId).toBe('1')
    expect(places()).toEqual(['网球场1', '网球场2'])

    await fieldByLabel(root.get('header'), '场馆').setValue('2')
    await flushPromises()
    expect(content(root).text()).toContain('没有符合条件的预约')
  })

  it('在“全部场馆”下取消预约：原因输入 maxlength=200（N2），必填；取消后状态更新', async () => {
    const { root } = await openSysApp('/sys-admin/reservations')
    const row = () => content(root).findAll('tbody tr')[0]
    if (row() === undefined) {
      throw new Error('没有预约行')
    }
    await buttonIn(row()!, '取消').trigger('click')
    const dialog = () => content(root).get('[role="dialog"]')

    expect(dialog().get('textarea').attributes('maxlength')).toBe('200')
    await buttonIn(dialog(), '确认取消').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('请填写原因')

    await dialog().get('textarea').setValue('场地检修')
    await buttonIn(dialog(), '确认取消').trigger('click')
    await flushPromises()
    expect(content(root).get('[role="status"]').text()).toBe('预约已取消')
    expect(row()?.findAll('td')[4]?.text()).toBe('管理员已取消')
  })

  it('N2：改派场地、改派人员的原因输入 maxlength=200；改派场地的可选场地来自该预约的场馆', async () => {
    const { root } = await openSysApp('/sys-admin/reservations')
    const first = () => content(root).findAll('tbody tr')[0]
    await buttonIn(first()!, '改派人员').trigger('click')
    expect(content(root).get('[role="dialog"] textarea').attributes('maxlength')).toBe('200')
    await buttonIn(content(root).get('[role="dialog"]'), '取消').trigger('click')

    await buttonIn(first()!, '改派场地').trigger('click')
    await flushPromises()
    const dialog = content(root).get('[role="dialog"]')
    expect(dialog.get('textarea').attributes('maxlength')).toBe('200')
    expect(fieldByLabel(dialog, '目标场地').findAll('option').map((option) => option.text())).toEqual([
      expect.any(String), '网球场1', '网球场2', '网球场3', '网球场4',
    ])
  })
})

describe('G6 操作记录：不选场馆', () => {
  async function openLogs(path = '/sys-admin/logs') {
    return openSysApp(path, {
      prepare: async (h) => {
        await h.api.adminCreateUser({ username: 'someone', password: 'Passw0rd!', displayName: '某人', role: 'USER' })
        await h.api.adminCancelReservation(1, { reason: '临时调整' })
      },
    })
  }

  it('缺省显示全部记录，多一列“场馆”：venueId 为 null 的记录显示“全局”', async () => {
    const { root } = await openLogs()
    const main = content(root)

    expect(main.get('h1').text()).toBe('操作记录')
    expect(main.findAll('th').map((th) => th.text())).toEqual(['场馆', '时间', '操作人', '动作', '对象', '原因', '详情'])
    expect(main.findAll('tbody tr').map((row) => [row.findAll('td')[0]?.text(), row.findAll('td')[3]?.text()])).toEqual([
      ['网球馆', '取消预约'], ['全局', '创建账号'],
    ])
  })

  it('选定网球馆后：只有该场馆的记录，没有“场馆”列', async () => {
    const { root } = await openLogs()
    await fieldByLabel(root.get('header'), '场馆').setValue('1')
    await flushPromises()
    const main = content(root)

    expect(main.findAll('th').map((th) => th.text())).not.toContain('场馆')
    expect(main.findAll('tbody tr').map((row) => row.findAll('td')[2]?.text())).toEqual(['取消预约'])
  })

  it('地址栏直接带 venueId=3：只看游泳馆，没有记录时显示空状态', async () => {
    const { root } = await openLogs('/sys-admin/logs?venueId=3')

    expect(content(root).text()).toContain('没有符合条件的操作记录')
  })
})

describe('S2 场馆运营页面挂在 /sys-admin 下', () => {
  it('占用总览、场馆公告、报修随所选场馆变化', async () => {
    const occupancy = await openSysApp('/sys-admin/occupancy?venueId=3')
    expect(content(occupancy.root).get('h1').text()).toBe('场地占用总览')
    expect(content(occupancy.root).get('p.hint').text()).toContain('游泳馆')

    const announcements = await openSysApp('/sys-admin/venue-announcements?venueId=1')
    expect(content(announcements.root).get('h1').text()).toBe('公告')
    expect(content(announcements.root).get('section[aria-label="场馆公告"]').text()).toContain('场地保养')
    expect(content(announcements.root).get('section[aria-label="系统公告"] h2').text()).toBe('系统公告（只读）')

    const repairs = await openSysApp('/sys-admin/repairs?venueId=2')
    expect(content(repairs.root).get('h1').text()).toBe('报修')
  })

  it('演示主线第 6 步：新增“训练池”后到场地页设定 6 条泳道（LANE），再设每周开放窗口', async () => {
    const { root, router, h } = await openSysApp('/sys-admin')
    const form = () => content(root).get('form[aria-label="新增场馆"]')
    await fieldByLabel(form(), '名称').setValue('训练池')
    await fieldByLabel(form(), '类型').setValue('SWIMMING')
    await buttonIn(form(), '新增场馆').trigger('submit')
    await flushPromises()
    await content(root).get('a[href*="/sys-admin/resources"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/sys-admin/resources?venueId=4')
    const count = content(root).get('form[aria-label="设定场地数量"]')
    await fieldByLabel(count, '场地数量').setValue('6')
    await fieldByLabel(count, '名称前缀').setValue('训练道')
    await fieldByLabel(count, '场地类型').setValue('LANE')
    await buttonIn(count, '设定数量').trigger('submit')
    await flushPromises()
    expect(content(root).get('[role="dialog"] h2').text()).toBe('将场地数量设为 6')
    await buttonIn(content(root).get('[role="dialog"]'), '确认').trigger('click')
    await flushPromises()

    const resourceRows = content(root).get('section[aria-label="场地"]').findAll('tbody tr')
    expect(resourceRows.map((row) => row.findAll('td').map((td) => td.text()).slice(0, 3))).toEqual(
      Array.from({ length: 6 }, (_unused, index) => [`训练道${index + 1}`, '泳道', '开放']),
    )

    const editor = content(root).get('section[aria-label="每周开放窗口"]')
    await buttonIn(editor, '添加窗口').trigger('click')
    const line = editor.get('li.row')
    await fieldByLabel(line, '星期').setValue('1')
    await fieldByLabel(line, '开放时间').setValue('09:00')
    await fieldByLabel(line, '关闭时间').setValue('12:00')
    await buttonIn(editor, '保存每周窗口').trigger('click')
    await flushPromises()
    await buttonIn(content(root).get('[role="dialog"]'), '确认').trigger('click')
    await flushPromises()

    const rules = await h.api.adminGetAvailabilityRules(4)
    expect(rules.weekly.map((window) => [window.weekday, window.openTime, window.closeTime])).toEqual([[1, '09:00', '12:00']])
  })
})
