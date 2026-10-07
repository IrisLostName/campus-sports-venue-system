// 影响检查（docs/12 第 5.5 节六条；docs/03 第 6 节；规划裁决 A9）：覆盖场馆关闭、场地状态、场地数量、周窗口、特殊关闭。
// 种子预约 1：zhangsan，网球场1，明天 08:00；预约 2：lisi，网球场2，明天 09:30。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import type { UpdateVenueRequest } from '../../../src/api/requests'
import type { LogAction } from '../../../src/api/types'
import { createHarness, expectApiError, travel, TOMORROW, type Harness } from '../support/harness'

type Control = Pick<UpdateVenueRequest, 'onExistingReservations' | 'reason' | 'dryRun'>

interface Scenario {
  name: string
  apply: (api: ApiClient, control: Control) => Promise<{ applied: boolean; impact: { affectedCount: number; reservations: { id: number }[] }; cancelledIds: number[]; data: unknown }>
  affected: number[]
  action: LogAction
}

const ALL_DAYS_SHORT = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openTime: '08:00', closeTime: '09:30' }))

const SCENARIOS: Scenario[] = [
  { name: '场馆关闭', affected: [1, 2], action: 'VENUE_UPDATE', apply: (api, c) => api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', ...c }) },
  { name: '场地设为维护', affected: [1], action: 'RESOURCE_STATUS_CHANGE', apply: (api, c) => api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', ...c }) },
  { name: '场地停用', affected: [1], action: 'RESOURCE_STATUS_CHANGE', apply: (api, c) => api.adminUpdateResource(1, { operationalStatus: 'DISABLED', ...c }) },
  { name: '缩小场地数量', affected: [2], action: 'RESOURCE_COUNT_CHANGE', apply: (api, c) => api.adminSetResourceCount(1, { count: 1, ...c }) },
  { name: '周窗口缩短', affected: [2], action: 'RULE_WEEKLY_UPDATE', apply: (api, c) => api.adminReplaceWeeklyRules(1, { windows: ALL_DAYS_SHORT, ...c }) },
  { name: '整馆特殊关闭', affected: [1, 2], action: 'CLOSURE_ADD', apply: (api, c) => api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW, ...c }) },
  { name: '单场地特殊关闭', affected: [2], action: 'CLOSURE_ADD', apply: (api, c) => api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW, resourceId: 2, ...c }) },
]

async function asSysAdmin(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('sysadmin')
  return h
}

function stateFingerprint(h: Harness): string {
  const { state } = h.context
  return JSON.stringify([state.venues, state.resources, state.weekly, state.closures, state.reservations, state.logs, state.seq])
}

const statusOf = (h: Harness, id: number) => h.context.state.reservations.find((r) => r.id === id)?.status

describe.each(SCENARIOS)('影响检查：$name', (scenario) => {
  it('第 1 条 dryRun：只计算，返回 applied=false、cancelledIds=[]、data=null，不修改任何数据', async () => {
    const h = await asSysAdmin()
    const before = stateFingerprint(h)
    const result = await scenario.apply(h.api, { dryRun: true })
    expect(result).toMatchObject({ applied: false, cancelledIds: [], data: null })
    expect(result.impact.affectedCount).toBe(scenario.affected.length)
    expect(result.impact.reservations.map((r) => r.id)).toEqual(scenario.affected)
    expect(stateFingerprint(h)).toBe(before)
  })

  it('第 2 条：存在受影响预约而未给出 onExistingReservations → IMPACT_CONFIRMATION_REQUIRED，details.impact', async () => {
    const h = await asSysAdmin()
    const before = stateFingerprint(h)
    const error = await expectApiError(scenario.apply(h.api, {}), 'IMPACT_CONFIRMATION_REQUIRED')
    expect(error.details).toMatchObject({ impact: { affectedCount: scenario.affected.length } })
    expect(stateFingerprint(h)).toBe(before)
  })

  it('第 3 条 KEEP：预约保留，cancelledIds 为空', async () => {
    const h = await asSysAdmin()
    const result = await scenario.apply(h.api, { onExistingReservations: 'KEEP' })
    expect(result).toMatchObject({ applied: true, cancelledIds: [] })
    expect(result.data).not.toBeNull()
    for (const id of scenario.affected) {
      expect(statusOf(h, id)).toBe('CONFIRMED')
    }
  })

  it('第 4 条 CANCEL：必须带 reason，否则 REASON_REQUIRED 且不修改数据', async () => {
    const h = await asSysAdmin()
    const before = stateFingerprint(h)
    await expectApiError(scenario.apply(h.api, { onExistingReservations: 'CANCEL' }), 'REASON_REQUIRED')
    await expectApiError(scenario.apply(h.api, { onExistingReservations: 'CANCEL', reason: '  ' }), 'REASON_REQUIRED')
    expect(stateFingerprint(h)).toBe(before)
  })

  it('第 4 条 CANCEL：受影响预约置 ADMIN_CANCELLED，admin_note = reason，cancelledIds 返回其 id', async () => {
    const h = await asSysAdmin()
    const result = await scenario.apply(h.api, { onExistingReservations: 'CANCEL', reason: '整修' })
    expect(result).toMatchObject({ applied: true, cancelledIds: scenario.affected })
    for (const id of scenario.affected) {
      const record = h.context.state.reservations.find((r) => r.id === id)
      expect(record).toMatchObject({ status: 'ADMIN_CANCELLED', adminNote: '整修', cancelledBy: 7 })
    }
    const untouched = [1, 2].filter((id) => !scenario.affected.includes(id))
    untouched.forEach((id) => expect(statusOf(h, id)).toBe('CONFIRMED'))
  })

  it('第 6 条：写操作日志，前后快照含受影响预约 id', async () => {
    const h = await asSysAdmin()
    await scenario.apply(h.api, { onExistingReservations: 'CANCEL', reason: '整修' })
    const logs = (await h.api.adminListLogs({ action: scenario.action })).items
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      adminName: '系统管理员', venueId: 1, reason: '整修',
      before: { affectedReservationIds: scenario.affected }, after: { affectedReservationIds: scenario.affected },
    })
  })
})

describe('第 5 条：无受影响预约时直接执行', () => {
  it('关闭没有预约的日期：不需要 onExistingReservations，affectedCount = 0', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminAddClosure(1, { startDate: '2026-10-15', endDate: '2026-10-16', reason: '校运会' })
    expect(result).toMatchObject({ applied: true, cancelledIds: [], impact: { affectedCount: 0, reservations: [] } })
    expect(result.data).toMatchObject({ startDate: '2026-10-15', endDate: '2026-10-16', resourceId: null, reason: '校运会' })
  })

  it('没有预约的场地设为维护 / 扩大场地数量 / 周窗口不缩小：直接执行', async () => {
    const h = await asSysAdmin()
    expect((await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })).impact.affectedCount).toBe(0)
    expect((await h.api.adminSetResourceCount(1, { count: 6 })).impact.affectedCount).toBe(0)
    const same = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openTime: '08:00', closeTime: '20:00' }))
    expect((await h.api.adminReplaceWeeklyRules(1, { windows: same })).impact.affectedCount).toBe(0)
  })

  it('已取消、已结束的预约不算受影响', async () => {
    const h = await asSysAdmin()
    await h.api.adminCancelReservation(1, { reason: '先取消' })
    expect((await h.api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', dryRun: true })).impact.reservations.map((r) => r.id)).toEqual([2])
    await travel(h, `${TOMORROW}T12:00:00`, 'sysadmin')
    expect((await h.api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', dryRun: true })).impact.affectedCount).toBe(0)
  })

  it('其他场馆的预约不受影响：关闭羽毛球馆不涉及网球馆预约', async () => {
    const h = await asSysAdmin()
    expect((await h.api.adminUpdateVenue(2, { operationalStatus: 'CLOSED' })).impact.affectedCount).toBe(0)
  })
})

describe('KEEP 只阻止新预约', () => {
  async function newBooking(h: Harness, resourceId: number, start: string) {
    await h.loginAs('wangwu')
    return h.api.createReservation({ resourceId, serviceDate: TOMORROW, startTime: start })
  }

  it('场馆关闭后：VENUE_NOT_BOOKABLE', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', onExistingReservations: 'KEEP' })
    await expectApiError(newBooking(h, 3, '14:00'), 'VENUE_NOT_BOOKABLE')
  })

  it('场地维护后：RESOURCE_UNAVAILABLE', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'KEEP' })
    await expectApiError(newBooking(h, 1, '14:00'), 'RESOURCE_UNAVAILABLE')
  })

  it('特殊关闭后：SLOT_NOT_AVAILABLE；被保留的预约仍在', async () => {
    const h = await asSysAdmin()
    await h.api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW, onExistingReservations: 'KEEP' })
    await expectApiError(newBooking(h, 3, '14:00'), 'SLOT_NOT_AVAILABLE')
    expect(statusOf(h, 1)).toBe('CONFIRMED')
  })

  it('CANCEL 释放时段后，原时段在场地恢复开放后可再次预约', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'CANCEL', reason: '维修' })
    await h.api.adminUpdateResource(1, { operationalStatus: 'OPEN' })
    await expect(newBooking(h, 1, '08:00')).resolves.toMatchObject({ status: 'CONFIRMED' })
  })
})

describe('影响检查的权限、范围与格式', () => {
  it('userBookingEnabled 的变化不做影响检查，既有预约不变', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminUpdateVenue(1, { userBookingEnabled: false })
    expect(result).toMatchObject({ applied: true, impact: { affectedCount: 0 }, data: { bookable: false } })
    expect(statusOf(h, 1)).toBe('CONFIRMED')
  })

  it('场馆管理员改 SA 才能改的字段 → FORBIDDEN；只改 description 可以', async () => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', onExistingReservations: 'KEEP' }), 'FORBIDDEN')
    await expectApiError(h.api.adminUpdateVenue(1, { userBookingEnabled: false }), 'FORBIDDEN')
    const result = await h.api.adminUpdateVenue(1, { description: '欢迎来打球' })
    expect(result.data).toMatchObject({ description: '欢迎来打球' })
  })

  it('场馆管理员操作授权之外的场馆、场地、规则 → FORBIDDEN_SCOPE', async () => {
    const h = createHarness()
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminUpdateVenue(1, { description: 'x' }), 'FORBIDDEN_SCOPE', { venueId: 1 })
    await expectApiError(h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', dryRun: true }), 'FORBIDDEN_SCOPE')
    await expectApiError(h.api.adminSetResourceCount(1, { count: 2, dryRun: true }), 'FORBIDDEN_SCOPE')
    await expectApiError(h.api.adminAddClosure(1, { startDate: TOMORROW, endDate: TOMORROW }), 'FORBIDDEN_SCOPE')
    await expectApiError(h.api.adminReplaceWeeklyRules(1, { windows: [] }), 'FORBIDDEN_SCOPE')
  })

  it('普通用户 FORBIDDEN；目标不存在 NOT_FOUND；onExistingReservations 非法值 VALIDATION_ERROR', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE' }), 'FORBIDDEN')
    await h.loginAs('sysadmin')
    await expectApiError(h.api.adminUpdateResource(999, { operationalStatus: 'MAINTENANCE' }), 'NOT_FOUND')
    await expectApiError(h.api.adminUpdateVenue(999, { description: 'x' }), 'NOT_FOUND')
    const bad = { operationalStatus: 'CLOSED', onExistingReservations: 'MAYBE' } as unknown as UpdateVenueRequest
    await expectApiError(h.api.adminUpdateVenue(1, bad), 'VALIDATION_ERROR')
  })

  it('REASON_REQUIRED 先于角色检查：普通用户选 CANCEL 且无原因', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'CANCEL' }), 'REASON_REQUIRED')
  })

  it('即使没有受影响预约，选择 CANCEL 仍需要原因', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'CANCEL' }), 'REASON_REQUIRED')
  })

  it('KEEP 时 reason 可选；若提供则写入日志', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'KEEP', reason: '保留并维护' })
    const [log] = (await h.api.adminListLogs({ action: 'RESOURCE_STATUS_CHANGE' })).items
    expect(log?.reason).toBe('保留并维护')
  })

  it('改场地名称或排序没有对应日志枚举，不写日志', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(3, { name: '网球场三号', sortOrder: 9 })
    expect((await h.api.adminListLogs()).total).toBe(0)
    const resources = await h.api.adminListResources(1)
    expect(resources.at(-1)).toMatchObject({ id: 3, name: '网球场三号', sortOrder: 9 })
  })
})
