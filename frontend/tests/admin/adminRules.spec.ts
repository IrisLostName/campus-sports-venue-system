// FE-5 P3：每周开放窗口与特殊关闭（走共用的影响检查流程，P4）。种子里“明天”是 2026-10-13（周二）：
// zhangsan 08:00 网球场1、lisi 09:30 网球场2。
import { describe, expect, it } from 'vitest'

import { TOMORROW } from './harness'
import { openResourcesPage } from './resourcesHarness'

describe('P3 每周开放窗口', () => {
  it('草稿取自接口返回的窗口；可添加 / 删除行', async () => {
    const { ctx, page } = await openResourcesPage()
    const stored = await ctx.api.adminGetAvailabilityRules(1)

    expect(page.rules.draft.value).toHaveLength(stored.weekly.length)
    expect(page.rules.draft.value[0]).toMatchObject({ weekday: String(stored.weekly[0]?.weekday), openTime: stored.weekly[0]?.openTime })
    page.rules.addRow()
    page.rules.addRow()
    const keys = page.rules.draft.value.map((row) => row.key)
    expect(new Set(keys).size).toBe(keys.length)
    page.rules.removeRow(keys[keys.length - 1] ?? -1)
    expect(page.rules.draft.value).toHaveLength(stored.weekly.length + 1)
  })

  it('有未填时间的行：提示补全，不发请求', async () => {
    const { page, calls } = await openResourcesPage()
    page.rules.addRow()
    await page.rules.saveWeekly()

    expect(page.error.value).toBe('请填写每个窗口的开放时间和关闭时间')
    expect(calls.some((call) => call.method === 'adminReplaceWeeklyRules')).toBe(false)
  })

  it('窗口不是 90 分钟整数倍：预检就得到 RULE_INVALID 文案，不打开对话框', async () => {
    const { page } = await openResourcesPage()
    const row = page.rules.draft.value.find((item) => item.weekday === '2')
    if (row !== undefined) {
      row.closeTime = '09:00'
    }
    await page.rules.saveWeekly()

    expect(page.error.value).toBe('开放规则不合法')
    expect(page.flow.dialog.value).toBeNull()
  })

  it('缩短周二窗口：预检列出落在窗口外的预约；选取消并填原因后整体替换', async () => {
    const { ctx, page, calls } = await openResourcesPage()
    const row = page.rules.draft.value.find((item) => item.weekday === '2')
    if (row !== undefined) {
      row.closeTime = '09:30'
    }
    await page.rules.saveWeekly()

    expect(page.flow.dialog.value?.title).toBe('保存每周开放窗口')
    expect(page.flow.dialog.value?.impact.reservations.map((brief) => brief.userDisplayName)).toEqual(['李四'])
    page.flow.choose('CANCEL')
    page.flow.setReason('调整开放时间')
    await page.flow.confirm()

    const sent = calls.filter((call) => call.method === 'adminReplaceWeeklyRules').map((call) => call.args[1] as Record<string, unknown>)
    expect(sent[0]).toMatchObject({ dryRun: true })
    expect(sent[1]).toMatchObject({ onExistingReservations: 'CANCEL', reason: '调整开放时间' })
    expect(sent[1]?.windows).toEqual(sent[0]?.windows)
    expect(page.notice.value).toBe('已保存，并取消 1 个受影响预约')
    const stored = await ctx.api.adminGetAvailabilityRules(1)
    expect(stored.weekly.find((window) => window.weekday === 2)?.closeTime).toBe('09:30')
    expect((await ctx.api.adminListReservations({ venueId: 1, keyword: '李四' })).items[0]?.status).toBe('ADMIN_CANCELLED')
  })

  it('不影响任何预约的修改：普通确认后提交', async () => {
    const { page } = await openResourcesPage()
    const row = page.rules.draft.value.find((item) => item.weekday === '3')
    if (row !== undefined) {
      row.closeTime = '12:30'
    }
    await page.rules.saveWeekly()
    expect(page.flow.dialog.value?.impact.affectedCount).toBe(0)
    await page.flow.confirm()

    expect(page.notice.value).toBe('已保存')
    expect(page.rules.draft.value.find((item) => item.weekday === '3')?.closeTime).toBe('12:30')
  })
})

describe('P3 特殊关闭', () => {
  it('起止日期必填', async () => {
    const { page, calls } = await openResourcesPage()
    page.rules.closureForm.startDate = TOMORROW
    await page.rules.submitClosure()

    expect(page.error.value).toBe('请填写关闭的起止日期')
    expect(calls.some((call) => call.method === 'adminAddClosure')).toBe(false)
  })

  it('整馆关闭一天：对话框原因预填表单里的原因；取消两个预约后列表出现该关闭，表单清空', async () => {
    const { page, calls } = await openResourcesPage()
    Object.assign(page.rules.closureForm, { startDate: TOMORROW, endDate: TOMORROW, reason: '节假日' })
    await page.rules.submitClosure()

    expect(page.flow.dialog.value?.impact.affectedCount).toBe(2)
    expect(page.flow.dialog.value?.reason).toBe('节假日')
    page.flow.choose('CANCEL')
    await page.flow.confirm()

    expect(calls.filter((call) => call.method === 'adminAddClosure').map((call) => call.args)).toEqual([
      [1, { startDate: TOMORROW, endDate: TOMORROW, reason: '节假日', dryRun: true }],
      [1, { startDate: TOMORROW, endDate: TOMORROW, reason: '节假日', onExistingReservations: 'CANCEL' }],
    ])
    expect(page.rules.closureRows.value).toEqual([{ id: 1, rangeText: TOMORROW, scopeText: '整馆', reasonText: '节假日' }])
    expect(page.rules.closureForm).toEqual({ startDate: '', endDate: '', resourceId: '', reason: '' })
    expect(page.notice.value).toBe('已保存，并取消 2 个受影响预约')
  })

  it('对话框里改过原因：最终只发送对话框里的原因', async () => {
    const { page, calls } = await openResourcesPage()
    Object.assign(page.rules.closureForm, { startDate: TOMORROW, endDate: TOMORROW, reason: '节假日' })
    await page.rules.submitClosure()
    page.flow.choose('CANCEL')
    page.flow.setReason('节假日，请改约')
    await page.flow.confirm()

    expect(calls.filter((call) => call.method === 'adminAddClosure')[1]?.args[1]).toMatchObject({ reason: '节假日，请改约' })
    expect(page.rules.closureRows.value[0]?.reasonText).toBe('节假日，请改约')
  })

})

describe('P3 特殊关闭（单场地与删除）', () => {
  it('单个场地、多日关闭：请求带 resourceId；只影响该场地上的预约；选保留不取消', async () => {
    const { ctx, page, calls } = await openResourcesPage()
    Object.assign(page.rules.closureForm, { startDate: TOMORROW, endDate: '2026-10-15', resourceId: '1' })
    await page.rules.submitClosure()
    expect(page.flow.dialog.value?.impact.reservations.map((brief) => brief.resourceName)).toEqual(['网球场1'])
    page.flow.choose('KEEP')
    await page.flow.confirm()

    expect(calls.filter((call) => call.method === 'adminAddClosure')[1]?.args[1]).toEqual({
      startDate: TOMORROW, endDate: '2026-10-15', resourceId: 1, onExistingReservations: 'KEEP',
    })
    expect(page.rules.closureRows.value[0]).toMatchObject({ rangeText: `${TOMORROW} 至 2026-10-15`, scopeText: '网球场1', reasonText: null })
    expect((await ctx.api.adminListReservations({ venueId: 1, keyword: '张三' })).items[0]?.status).toBe('CONFIRMED')
  })

  it('结束日期早于开始日期：预检得到 RULE_INVALID 文案', async () => {
    const { page } = await openResourcesPage()
    Object.assign(page.rules.closureForm, { startDate: '2026-10-15', endDate: '2026-10-14' })
    await page.rules.submitClosure()

    expect(page.error.value).toBe('开放规则不合法')
    expect(page.flow.dialog.value).toBeNull()
  })

  it('删除：先确认；确认后调用 adminRemoveClosure，列表为空', async () => {
    const { page, calls } = await openResourcesPage()
    Object.assign(page.rules.closureForm, { startDate: '2026-11-20', endDate: '2026-11-20' })
    await page.rules.submitClosure()
    await page.flow.confirm()
    expect(page.rules.closureRows.value).toHaveLength(1)

    page.rules.askRemove(1)
    expect(page.rules.remove.value).toMatchObject({ id: 1, summary: '2026-11-20 · 整馆' })
    page.rules.dismissRemove()
    expect(calls.some((call) => call.method === 'adminRemoveClosure')).toBe(false)

    page.rules.askRemove(1)
    await page.rules.confirmRemove()

    expect(calls.find((call) => call.method === 'adminRemoveClosure')?.args).toEqual([1])
    expect(page.rules.remove.value).toBeNull()
    expect(page.rules.closureRows.value).toEqual([])
    expect(page.notice.value).toBe('特殊关闭已移除')
  })
})
