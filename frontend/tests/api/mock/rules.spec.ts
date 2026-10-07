// 开放规则：每周窗口整体替换与特殊关闭（docs/12 第 5.6 节；docs/03 第 3 节；docs/13 第 3.4 节；规划裁决 A8、A9）。
import { describe, expect, it } from 'vitest'

import type { WeeklyWindowInput } from '../../../src/api/requests'
import { createHarness, expectApiError, TODAY, TOMORROW, type Harness } from '../support/harness'

async function asSysAdmin(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('sysadmin')
  return h
}

const window = (weekday: number, openTime: string, closeTime: string): WeeklyWindowInput => ({ weekday, openTime, closeTime })

describe('周窗口校验：RULE_INVALID（reason 说明原因）', () => {
  it.each([
    ['长度不是 90 分钟整数倍（60 分钟）', [window(1, '08:00', '09:00')]],
    ['长度不是 90 分钟整数倍（100 分钟）', [window(1, '08:00', '09:40')]],
    ['开始等于结束', [window(1, '10:00', '10:00')]],
    ['开始晚于结束（跨天写法）', [window(1, '22:30', '01:30')]],
    ['同一星期的窗口重叠', [window(1, '08:00', '11:00'), window(1, '09:30', '12:30')]],
    ['同一星期的窗口包含', [window(2, '08:00', '14:30'), window(2, '10:30', '12:00')]],
  ])('%s', async (_label, windows) => {
    const h = await asSysAdmin()
    const error = await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows }), 'RULE_INVALID')
    expect(typeof error.details?.reason).toBe('string')
  })

  it('RULE_INVALID 时不修改既有窗口', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(1, '08:00', '09:00')] }), 'RULE_INVALID')
    expect((await h.api.adminGetAvailabilityRules(1)).weekly).toHaveLength(7)
  })

  it.each([
    ['首尾相接（08:00–09:30、09:30–11:00）', [window(1, '08:00', '09:30'), window(1, '09:30', '11:00')]],
    ['不同星期相同时间', [window(1, '08:00', '09:30'), window(2, '08:00', '09:30')]],
    ['两个 90 分钟整数倍窗口，中间有间隔', [window(3, '08:00', '11:00'), window(3, '14:00', '15:30')]],
    ['最晚收馆 22:30', [window(4, '21:00', '22:30')]],
  ])('合法：%s', async (_label, windows) => {
    const h = await asSysAdmin()
    await expect(h.api.adminReplaceWeeklyRules(1, { windows, onExistingReservations: 'KEEP' }))
      .resolves.toMatchObject({ applied: true })
  })

  it('weekday 超出 1–7、时刻格式错误 → VALIDATION_ERROR（格式阶段，先于规则校验）', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(0, '08:00', '09:30')] }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(8, '08:00', '09:30')] }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(1, '8:00', '09:30')] }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(1, '22:30', '24:00')] }), 'VALIDATION_ERROR')
  })

  it('越权场馆先于 RULE_INVALID：FORBIDDEN_SCOPE', async () => {
    const h = createHarness()
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [window(1, '08:00', '09:00')] }), 'FORBIDDEN_SCOPE')
  })
})

describe('周窗口整体替换', () => {
  it('旧窗口被停用，只返回新窗口；新窗口获得新 id，按星期与开始时间排序', async () => {
    const h = await asSysAdmin()
    const before = (await h.api.adminGetAvailabilityRules(1)).weekly
    const result = await h.api.adminReplaceWeeklyRules(1, {
      windows: [window(3, '14:00', '15:30'), window(3, '08:00', '09:30')], onExistingReservations: 'KEEP',
    })
    expect(result.data?.map((w) => [w.weekday, w.openTime, w.closeTime])).toEqual([[3, '08:00', '09:30'], [3, '14:00', '15:30']])
    expect(result.data?.every((w) => !before.some((old) => old.id === w.id))).toBe(true)
    expect((await h.api.adminGetAvailabilityRules(1)).weekly).toEqual(result.data)
  })

  it('空数组 = 场馆没有任何开放窗口，预约新时段返回 SLOT_NOT_AVAILABLE', async () => {
    const h = await asSysAdmin()
    await h.api.adminReplaceWeeklyRules(1, { windows: [], onExistingReservations: 'KEEP' })
    await h.loginAs('wangwu')
    await expectApiError(h.api.createReservation({ resourceId: 3, serviceDate: TODAY, startTime: '09:30' }), 'SLOT_NOT_AVAILABLE')
  })

  it('其他场馆的窗口不受影响', async () => {
    const h = await asSysAdmin()
    await h.api.adminReplaceWeeklyRules(1, { windows: [], onExistingReservations: 'KEEP' })
    expect((await h.api.adminGetAvailabilityRules(2)).weekly).toHaveLength(7)
  })
})

describe('特殊关闭', () => {
  it('新增：返回 Closure（整馆 resourceId 为 null），GET 列出 ACTIVE 的关闭规则', async () => {
    const h = await asSysAdmin()
    const added = await h.api.adminAddClosure(1, { startDate: '2026-10-15', endDate: '2026-10-16', reason: '校运会' })
    expect(added.data).toMatchObject({ venueId: 1, resourceId: null, startDate: '2026-10-15', endDate: '2026-10-16', reason: '校运会' })
    expect((await h.api.adminGetAvailabilityRules(1)).closures).toEqual([added.data])
  })

  it('单日关闭 startDate = endDate 合法；endDate < startDate → RULE_INVALID', async () => {
    const h = await asSysAdmin()
    await expect(h.api.adminAddClosure(1, { startDate: '2026-10-15', endDate: '2026-10-15' })).resolves.toMatchObject({ applied: true })
    const error = await expectApiError(h.api.adminAddClosure(1, { startDate: '2026-10-16', endDate: '2026-10-15' }), 'RULE_INVALID')
    expect(typeof error.details?.reason).toBe('string')
  })

  it('日期格式错误 → VALIDATION_ERROR；过去的日期不被禁止', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminAddClosure(1, { startDate: '2026/10/15', endDate: '2026-10-15' }), 'VALIDATION_ERROR')
    await expect(h.api.adminAddClosure(1, { startDate: '2026-01-01', endDate: '2026-01-02' })).resolves.toMatchObject({ applied: true })
  })

  it('resourceId 必须是本场馆的场地', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW, resourceId: 5 }), 'VALIDATION_ERROR')
    await expect(h.api.adminAddClosure(1, { startDate: '2026-10-16', endDate: '2026-10-16', resourceId: 3 })).resolves.toMatchObject({ applied: true })
  })

  it('删除（停用）：返回 undefined（204），不再出现在 GET 里，时段重新开放，写日志 CLOSURE_REMOVE', async () => {
    const h = await asSysAdmin()
    const added = await h.api.adminAddClosure(1, { startDate: '2026-10-15', endDate: '2026-10-15' })
    const id = added.data?.id ?? 0
    await expect(h.api.adminRemoveClosure(id)).resolves.toBeUndefined()
    expect((await h.api.adminGetAvailabilityRules(1)).closures).toEqual([])
    await h.loginAs('lisi')
    expect((await h.api.getVenueSlots(1, '2026-10-15')).resources[0]?.slots[0]?.status).toBe('AVAILABLE')
    await h.loginAs('sysadmin')
    const [log] = (await h.api.adminListLogs({ action: 'CLOSURE_REMOVE' })).items
    expect(log).toMatchObject({ targetType: 'RULE', targetId: id, venueId: 1 })
  })

  it('删除不做影响检查：被关闭取消的预约不会恢复', async () => {
    const h = await asSysAdmin()
    const added = await h.api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW, onExistingReservations: 'CANCEL', reason: '临时' })
    await h.api.adminRemoveClosure(added.data?.id ?? 0)
    expect(h.context.state.reservations.map((r) => r.status)).toEqual(['ADMIN_CANCELLED', 'ADMIN_CANCELLED'])
  })

  it('删除不存在或已停用的关闭规则 → NOT_FOUND；越权 FORBIDDEN_SCOPE；普通用户 FORBIDDEN', async () => {
    const h = await asSysAdmin()
    const added = await h.api.adminAddClosure(1, { startDate: '2026-10-15', endDate: '2026-10-15' })
    const id = added.data?.id ?? 0
    await expectApiError(h.api.adminRemoveClosure(999), 'NOT_FOUND')
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminRemoveClosure(id), 'FORBIDDEN_SCOPE')
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminRemoveClosure(id), 'FORBIDDEN')
    await h.loginAs('admin_tennis')
    await h.api.adminRemoveClosure(id)
    await expectApiError(h.api.adminRemoveClosure(id), 'NOT_FOUND')
  })

  it('读取规则：角色与授权范围', async () => {
    const h = createHarness()
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminGetAvailabilityRules(1), 'FORBIDDEN_SCOPE')
    await expect(h.api.adminGetAvailabilityRules(2)).resolves.toMatchObject({ closures: [] })
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminGetAvailabilityRules(1), 'FORBIDDEN')
  })
})
