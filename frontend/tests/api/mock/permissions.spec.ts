// 角色与授权范围（docs/12 第 5 节权限列、第 6 节）：普通用户不能进管理端，场馆管理员限授权场馆，授权变更立即生效。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { createHarness, expectApiError, TOMORROW, type Harness } from '../support/harness'

type Call = (api: ApiClient) => Promise<unknown>

const ADMIN_CALLS: ReadonlyArray<readonly [string, Call]> = [
  ['adminListRepairs', (a) => a.adminListRepairs()],
  ['adminUpdateRepair', (a) => a.adminUpdateRepair(1, { status: 'IN_PROGRESS' })],
  ['adminListVenues', (a) => a.adminListVenues()],
  ['adminListResources', (a) => a.adminListResources(1)],
  ['adminGetOccupancy', (a) => a.adminGetOccupancy(1, TOMORROW)],
  ['adminGetAvailabilityRules', (a) => a.adminGetAvailabilityRules(1)],
  ['adminListReservations', (a) => a.adminListReservations()],
  ['adminCancelReservation', (a) => a.adminCancelReservation(1, { reason: 'x' })],
  ['adminListAnnouncements', (a) => a.adminListAnnouncements()],
  ['adminCreateAnnouncement', (a) => a.adminCreateAnnouncement({ scope: 'VENUE', venueId: 1, title: 't', content: 'c' })],
  ['adminArchiveAnnouncement', (a) => a.adminArchiveAnnouncement(2)],
  ['adminGetStatsOverview', (a) => a.adminGetStatsOverview()],
  ['adminListLogs', (a) => a.adminListLogs()],
]

const SYSADMIN_ONLY_CALLS: ReadonlyArray<readonly [string, Call]> = [
  ['adminCreateVenue', (a) => a.adminCreateVenue({ name: 'x', venueType: 'OTHER' })],
  ['adminListUsers', (a) => a.adminListUsers()],
  ['adminCreateUser', (a) => a.adminCreateUser({ username: 'abc', password: '12345678', displayName: 'x', role: 'USER' })],
  ['adminUpdateUser', (a) => a.adminUpdateUser(1, { displayName: 'x' })],
  ['adminSetVenueScope', (a) => a.adminSetVenueScope(5, { venueIds: [1] })],
]

const USER_CALLS: ReadonlyArray<readonly [string, Call]> = [
  ['createReservation', (a) => a.createReservation({ resourceId: 1, serviceDate: TOMORROW, startTime: '14:00' })],
  ['listMyReservations', (a) => a.listMyReservations()],
  ['cancelReservation', (a) => a.cancelReservation(1)],
  ['checkIn', (a) => a.checkIn(1)],
  ['checkOut', (a) => a.checkOut(1)],
  ['createRepair', (a) => a.createRepair({ venueId: 1, description: 'x' })],
  ['listMyRepairs', (a) => a.listMyRepairs()],
]

describe('普通用户不能调用管理端接口', () => {
  it.each(ADMIN_CALLS)('%s → FORBIDDEN', async (_name, call) => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await expectApiError(call(h.api), 'FORBIDDEN')
  })

  it.each([...ADMIN_CALLS, ...SYSADMIN_ONLY_CALLS, ...USER_CALLS])('%s 未登录 → AUTH_REQUIRED', async (_name, call) => {
    const h = createHarness()
    await expectApiError(call(h.api), 'AUTH_REQUIRED')
  })
})

describe('仅系统管理员可用的接口', () => {
  it.each(SYSADMIN_ONLY_CALLS)('%s：场馆管理员与普通用户 FORBIDDEN', async (_name, call) => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expectApiError(call(h.api), 'FORBIDDEN')
    await h.loginAs('zhangsan')
    await expectApiError(call(h.api), 'FORBIDDEN')
  })
})

describe('仅普通用户可用的接口', () => {
  it.each(USER_CALLS)('%s：管理员角色 FORBIDDEN', async (_name, call) => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expectApiError(call(h.api), 'FORBIDDEN')
    await h.loginAs('sysadmin')
    await expectApiError(call(h.api), 'FORBIDDEN')
  })
})

describe('场馆管理员的授权范围', () => {
  it('管理端场馆列表只含授权场馆', async () => {
    const h = createHarness()
    await h.loginAs('admin_pool')
    expect((await h.api.adminListVenues()).map((v) => v.id)).toEqual([2, 3])
    await h.loginAs('admin_tennis')
    expect((await h.api.adminListVenues()).map((v) => v.id)).toEqual([1])
    await h.loginAs('sysadmin')
    expect((await h.api.adminListVenues()).map((v) => v.id)).toEqual([1, 2, 3])
  })

  it('读取越权场馆的场地、占用总览、预约详情 → FORBIDDEN_SCOPE', async () => {
    const h = createHarness()
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminListResources(1), 'FORBIDDEN_SCOPE', { venueId: 1 })
    await expectApiError(h.api.adminGetOccupancy(1, TOMORROW), 'FORBIDDEN_SCOPE')
    await expectApiError(h.api.getReservation(1), 'FORBIDDEN_SCOPE')
    await expect(h.api.adminGetOccupancy(2, TOMORROW)).resolves.toMatchObject({ venueName: '羽毛球馆' })
  })

  it('撤销授权立即生效；重新授权立即恢复', async () => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expect(h.api.adminListResources(1)).resolves.toHaveLength(4)
    await h.loginAs('sysadmin')
    await h.api.adminSetVenueScope(5, { venueIds: [2] })
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminListResources(1), 'FORBIDDEN_SCOPE')
    expect((await h.api.getMe()).venueIds).toEqual([2])
    await h.loginAs('sysadmin')
    await h.api.adminSetVenueScope(5, { venueIds: [1, 2] })
    await h.loginAs('admin_tennis')
    await expect(h.api.adminListResources(1)).resolves.toHaveLength(4)
  })
})

describe('预约详情的可见性（GET /reservations/{id}）', () => {
  it('本人可见；他人 NOT_OWNER；不存在 NOT_FOUND', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await expect(h.api.getReservation(1)).resolves.toMatchObject({ id: 1, userDisplayName: '张三' })
    await expectApiError(h.api.getReservation(2), 'NOT_OWNER')
    await expectApiError(h.api.getReservation(999), 'NOT_FOUND')
  })

  it('授权场馆的场馆管理员与系统管理员可见', async () => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expect(h.api.getReservation(2)).resolves.toMatchObject({ id: 2 })
    await h.loginAs('sysadmin')
    await expect(h.api.getReservation(2)).resolves.toMatchObject({ id: 2 })
  })
})

describe('我的预约（GET /reservations/me）', () => {
  async function withThree(h: Harness) {
    await h.loginAs('zhangsan')
    await h.api.createReservation({ resourceId: 2, serviceDate: TOMORROW, startTime: '11:00' })
    await h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '12:30' })
    const [cancelled] = (await h.api.listMyReservations({ scope: 'CURRENT' })).items
    await h.api.cancelReservation(cancelled?.id ?? 0)
  }

  it('CURRENT 按开始时间升序；HISTORY 倒序；ALL 倒序且同刻按 id 倒序', async () => {
    const h = createHarness()
    await withThree(h)
    const times = async (scope: 'CURRENT' | 'HISTORY' | 'ALL') =>
      (await h.api.listMyReservations({ scope })).items.map((r) => `${r.startTime}:${r.status}`)
    expect(await times('CURRENT')).toEqual(['11:00:CONFIRMED', '12:30:CONFIRMED'])
    expect(await times('HISTORY')).toEqual(['08:00:CANCELLED'])
    expect(await times('ALL')).toEqual(['12:30:CONFIRMED', '11:00:CONFIRMED', '08:00:CANCELLED'])
  })

  it('缺省 scope 为 ALL；分页返回 page、pageSize、total', async () => {
    const h = createHarness()
    await withThree(h)
    const page = await h.api.listMyReservations({ page: 2, pageSize: 2 })
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3 })
    expect(page.items.map((r) => r.startTime)).toEqual(['08:00'])
  })

  it('非法 scope 或分页参数 → VALIDATION_ERROR；只返回自己的预约', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await expectApiError(h.api.listMyReservations({ pageSize: 0 }), 'VALIDATION_ERROR')
    await expectApiError(h.api.listMyReservations({ scope: 'EVERYTHING' as 'ALL' }), 'VALIDATION_ERROR')
    expect((await h.api.listMyReservations()).items.map((r) => r.userDisplayName)).toEqual(['李四'])
  })
})
