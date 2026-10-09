// FE-6 G6 / G7 / S2 / N5：复用 FE-5 组合函数的“全部场馆”模式、系统管理员对新场馆的运营（LANE 场地与开放窗口）、简介未改动不提交。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { createAdminLogs } from '../../src/composables/adminLogs'
import { createAdminReservations } from '../../src/composables/adminReservations'
import { buildLogRow } from '../../src/utils/adminLogDisplay'
import { TOMORROW, loginAdmin, spyOn } from '../admin/harness'
import { openResourcesPage } from '../admin/resourcesHarness'

// 让羽毛球馆对用户开放，并由 wangwu 在羽毛球场1 预约明天 09:30，使两个场馆都有预约。
async function seedBadmintonReservation(api: ApiClient, h: Awaited<ReturnType<typeof loginAdmin>>['h']): Promise<number> {
  await api.adminUpdateVenue(2, { userBookingEnabled: true })
  const wangwu = await h.clientFor('wangwu')
  return (await wangwu.createReservation({ resourceId: 5, serviceDate: TOMORROW, startTime: '09:30' })).id
}

describe('G7 预约管理：全部场馆', () => {
  it('不带 venueId 查询，场地列显示场馆名；指定场馆时不带场馆名', async () => {
    const ctx = await loginAdmin('sysadmin')
    await seedBadmintonReservation(ctx.api, ctx.h)
    const spy = spyOn(ctx.api)
    const all = createAdminReservations({ api: spy.client, call: ctx.call })
    await all.load()

    expect(spy.calls.filter((call) => call.method === 'adminListReservations').map((call) => call.args)).toEqual([[{ page: 1 }]])
    expect(all.rows.value.map((row) => row.place).sort()).toEqual(['网球馆 · 网球场1', '网球馆 · 网球场2', '羽毛球馆 · 羽毛球场1'])

    const one = createAdminReservations({ api: spy.client, call: ctx.call }, 2)
    await one.load()
    expect(spy.calls.filter((call) => call.method === 'adminListReservations').at(-1)?.args).toEqual([{ venueId: 2, page: 1 }])
    expect(one.rows.value.map((row) => row.place)).toEqual(['羽毛球场1'])
  })

  it('在“全部场馆”下取消别的场馆的预约：按该预约所在场馆处理，原因必填', async () => {
    const ctx = await loginAdmin('sysadmin')
    const id = await seedBadmintonReservation(ctx.api, ctx.h)
    const spy = spyOn(ctx.api)
    const all = createAdminReservations({ api: spy.client, call: ctx.call })
    await all.load()
    all.actions.openCancel(id)
    await all.actions.confirmCancel()
    expect(all.actions.cancel.value?.error).toBe('请填写原因')

    all.actions.patchCancel({ reason: '羽毛球馆检修' })
    await all.actions.confirmCancel()

    expect(spy.calls.filter((call) => call.method === 'adminCancelReservation').map((call) => call.args)).toEqual([[id, { reason: '羽毛球馆检修' }]])
    expect(all.rows.value.find((row) => row.id === id)?.statusLabel).toBe('管理员已取消')
    expect(all.notice.value).toBe('预约已取消')
  })

  it('改派场地：目标场地取该预约所在场馆（羽毛球馆），不是第一个场馆', async () => {
    const ctx = await loginAdmin('sysadmin')
    const id = await seedBadmintonReservation(ctx.api, ctx.h)
    const spy = spyOn(ctx.api)
    const all = createAdminReservations({ api: spy.client, call: ctx.call })
    await all.load()
    await all.reassign.open(id)

    expect(all.reassign.state.value?.venueId).toBe(2)
    expect(spy.calls.filter((call) => call.method === 'adminGetOccupancy').map((call) => call.args)).toEqual([[2, TOMORROW]])
    expect(all.reassign.state.value?.options.map((option) => option.name)).toEqual(Array.from({ length: 6 }, (_unused, index) => `羽毛球场${index + 1}`))

    all.reassign.patch({ resourceId: '6', startTime: '09:30', reason: '换到场地2' })
    await all.reassign.confirm()
    expect(all.rows.value.find((row) => row.id === id)?.place).toBe('羽毛球馆 · 羽毛球场2')
  })
})

describe('G6 操作记录：不选场馆', () => {
  it('不带 venueId 查询，包含 venueId 为 null 的记录；场馆列显示场馆名，null 显示“全局”', async () => {
    const ctx = await loginAdmin('sysadmin')
    await ctx.api.adminCreateUser({ username: 'someone', password: 'Passw0rd!', displayName: '某人', role: 'USER' })
    await ctx.api.adminCancelReservation(1, { reason: '临时调整' })
    const venues = await ctx.api.adminListVenues()
    const spy = spyOn(ctx.api)
    const logs = createAdminLogs({ api: spy.client, call: ctx.call }, undefined, () => venues)
    await logs.load()

    expect(spy.calls.filter((call) => call.method === 'adminListLogs').map((call) => call.args)).toEqual([[{ page: 1 }]])
    expect(logs.rows.value.map((row) => [row.actionLabel, row.venueText])).toEqual([['取消预约', '网球馆'], ['创建账号', '全局']])
  })

  it('指定场馆时带 venueId，行里没有场馆列文字，venueId 为 null 的记录不出现', async () => {
    const ctx = await loginAdmin('sysadmin')
    await ctx.api.adminCreateUser({ username: 'someone', password: 'Passw0rd!', displayName: '某人', role: 'USER' })
    await ctx.api.adminCancelReservation(1, { reason: '临时调整' })
    const spy = spyOn(ctx.api)
    const logs = createAdminLogs({ api: spy.client, call: ctx.call }, 1)
    await logs.load()

    expect(spy.calls.filter((call) => call.method === 'adminListLogs').map((call) => call.args)).toEqual([[{ venueId: 1, page: 1 }]])
    expect(logs.rows.value.map((row) => row.actionLabel)).toEqual(['取消预约'])
    expect(logs.rows.value[0]).not.toHaveProperty('venueText')
  })

  it('按动作筛选仍然有效；没有场馆名映射时显示“场馆 #id”', async () => {
    const ctx = await loginAdmin('sysadmin')
    await ctx.api.adminCreateUser({ username: 'someone', password: 'Passw0rd!', displayName: '某人', role: 'USER' })
    await ctx.api.adminCancelReservation(1, { reason: '临时调整' })
    const spy = spyOn(ctx.api)
    const logs = createAdminLogs({ api: spy.client, call: ctx.call })
    logs.filters.action = 'USER_CREATE'
    await logs.search()

    expect(spy.calls.filter((call) => call.method === 'adminListLogs').at(-1)?.args).toEqual([{ page: 1, action: 'USER_CREATE' }])
    expect(logs.rows.value.map((row) => row.venueText)).toEqual(['全局'])
    const base = (await ctx.api.adminListLogs({})).items[0]
    if (base === undefined) {
      throw new Error('缺少日志')
    }
    expect(buildLogRow(base, new Map()).venueText).toBe('场馆 #1')
  })
})

describe('S2 系统管理员对新场馆的运营（演示主线第 6 步）', () => {
  it('新增“训练池”后在场地页设定 6 条泳道（LANE）和每周开放窗口', async () => {
    const { ctx, page } = await openResourcesPage('sysadmin', 1, async (api) => (
      await api.adminCreateVenue({ name: '训练池', venueType: 'SWIMMING' })
    ).id)
    page.resources.form.count = '6'
    page.resources.form.namePrefix = '训练道'
    page.resources.form.resourceType = 'LANE'
    await page.resources.submitCount()
    await page.flow.confirm()

    expect(page.resources.rows.value.map((row) => [row.name, row.typeLabel])).toEqual(
      Array.from({ length: 6 }, (_unused, index) => [`训练道${index + 1}`, '泳道']),
    )

    page.rules.addRow()
    const row = page.rules.draft.value.at(-1)
    if (row === undefined) {
      throw new Error('没有新增窗口行')
    }
    Object.assign(row, { weekday: '1', openTime: '09:00', closeTime: '12:00' })
    await page.rules.saveWeekly()
    await page.flow.confirm()

    const venue = (await ctx.api.adminListVenues()).find((item) => item.name === '训练池')
    expect(venue?.resourceCount).toBe(6)
    const rules = await ctx.api.adminGetAvailabilityRules(venue?.id ?? 0)
    expect(rules.weekly.map((window) => [window.weekday, window.openTime, window.closeTime])).toEqual([[1, '09:00', '12:00']])
  })
})

describe('N5 场馆简介没有改动时不提交', () => {
  it('简介为 null 的场馆：直接保存不发请求；改了才提交一次；清空非空简介照实提交，接口拒绝时显示文案', async () => {
    const { page, calls } = await openResourcesPage()
    await page.profile.save()
    expect(calls.some((call) => call.method === 'adminUpdateVenue')).toBe(false)

    page.profile.form.description = '室内网球馆'
    await page.profile.save()
    expect(calls.filter((call) => call.method === 'adminUpdateVenue').map((call) => call.args)).toEqual([[1, { description: '室内网球馆' }]])
    expect(page.notice.value).toBe('场馆简介已保存')

    page.profile.form.description = ''
    await page.profile.save()
    expect(calls.filter((call) => call.method === 'adminUpdateVenue').map((call) => call.args).at(-1)).toEqual([1, { description: '' }])
    expect(page.error.value).toBe('请求参数不合法')
  })

  it('只有空白的改动视为没有改动', async () => {
    const { page, calls } = await openResourcesPage()
    page.profile.form.description = '   '
    await page.profile.save()

    expect(calls.some((call) => call.method === 'adminUpdateVenue')).toBe(false)
  })
})
