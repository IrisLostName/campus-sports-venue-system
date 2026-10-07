// 操作记录查询（docs/12 第 5.10 节；规划裁决 §7-7、§7-8）。
// 场馆管理员只看 venueId 属于授权场馆的日志；venueId 为 null 的日志对其不可见；指定越权 venueId → FORBIDDEN_SCOPE。
import { describe, expect, it } from 'vitest'

import { LOG_TARGET } from '../../../src/api/mock/logService'
import type { LogAction } from '../../../src/api/types'
import { createHarness, expectApiError, travel, TOMORROW, type Harness } from '../support/harness'

async function seeded(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('admin_tennis')
  await h.api.adminCancelReservation(1, { reason: '网球馆取消' })
  await h.loginAs('admin_pool')
  await h.api.adminAddClosure(2, { startDate: TOMORROW, endDate: TOMORROW, reason: '羽毛球馆关闭' })
  await h.loginAs('sysadmin')
  await h.api.adminCreateUser({ username: 'newadmin', password: 'Passw0rd!', displayName: '新管理员', role: 'SYS_ADMIN' })
  return h
}

describe('日志可见范围', () => {
  it('场馆管理员只看到授权场馆的日志，看不到 venueId 为 null 的日志', async () => {
    const h = await seeded()
    await h.loginAs('admin_tennis')
    expect((await h.api.adminListLogs()).items.map((l) => l.action)).toEqual(['RESERVATION_CANCEL'])
    await h.loginAs('admin_pool')
    expect((await h.api.adminListLogs()).items.map((l) => l.action)).toEqual(['CLOSURE_ADD'])
  })

  it('系统管理员看到全部（含 venueId 为 null 的全局操作），按时间倒序', async () => {
    const h = await seeded()
    h.clock.advanceMinutes(5)
    await h.api.adminUpdateUser(4, { status: 'DISABLED' })
    const items = (await h.api.adminListLogs()).items
    expect(items.map((l) => l.action)).toEqual(['USER_STATUS_CHANGE', 'USER_CREATE', 'CLOSURE_ADD', 'RESERVATION_CANCEL'])
    expect(items.filter((l) => l.venueId === null)).toHaveLength(2)
  })

  it('场馆管理员指定授权范围内的 venueId 可查，范围外 FORBIDDEN_SCOPE', async () => {
    const h = await seeded()
    await h.loginAs('admin_pool')
    expect((await h.api.adminListLogs({ venueId: 2 })).total).toBe(1)
    await expectApiError(h.api.adminListLogs({ venueId: 1 }), 'FORBIDDEN_SCOPE', { venueId: 1 })
    await h.loginAs('sysadmin')
    expect((await h.api.adminListLogs({ venueId: 1 })).total).toBe(1)
  })

  it('普通用户 FORBIDDEN', async () => {
    const h = await seeded()
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminListLogs(), 'FORBIDDEN')
  })
})

describe('日志过滤与分页', () => {
  it('按 action、日期范围过滤', async () => {
    const h = await seeded()
    expect((await h.api.adminListLogs({ action: 'USER_CREATE' })).total).toBe(1)
    await travel(h, `${TOMORROW}T10:00:00`, 'sysadmin')
    await h.api.adminUpdateUser(4, { status: 'DISABLED' })
    expect((await h.api.adminListLogs({ dateFrom: TOMORROW })).items.map((l) => l.action)).toEqual(['USER_STATUS_CHANGE'])
    expect((await h.api.adminListLogs({ dateTo: '2026-10-12' })).total).toBe(3)
  })

  it('分页；非法参数 VALIDATION_ERROR', async () => {
    const h = await seeded()
    expect(await h.api.adminListLogs({ page: 2, pageSize: 2 })).toMatchObject({ page: 2, pageSize: 2, total: 3 })
    await expectApiError(h.api.adminListLogs({ action: 'NOPE' as LogAction }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminListLogs({ dateFrom: '10/12' }), 'VALIDATION_ERROR')
  })

  it('日志记录管理员姓名、目标类型、前后快照', async () => {
    const h = await seeded()
    const [log] = (await h.api.adminListLogs({ action: 'CLOSURE_ADD' })).items
    expect(log).toMatchObject({
      adminId: 6, adminName: '游泳羽毛球馆管理员', targetType: 'RULE', reason: '羽毛球馆关闭',
      createdAt: '2026-10-12T07:00:00', before: { affectedReservationIds: [] },
    })
  })
})

describe('action → targetType 对照表只使用 12 第 2 节的枚举', () => {
  it('覆盖全部 15 个 LogAction', () => {
    expect(Object.keys(LOG_TARGET)).toHaveLength(15)
    expect(new Set(Object.values(LOG_TARGET))).toEqual(new Set(['RESERVATION', 'RESOURCE', 'VENUE', 'RULE', 'USER', 'SCOPE', 'ANNOUNCEMENT', 'REPAIR']))
  })
})
