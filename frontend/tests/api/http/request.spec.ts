// http.ts 请求构造：以替身 fetch 断言方法、路径、查询、请求体、请求头（docs/12 第 1、5 节）。
// 本文件不连接任何后端；http 适配器对真实后端的契约测试属于 BE-8。
import { describe, expect, it } from 'vitest'

import { API_CLIENT_METHODS, type ApiClient } from '../../../src/api/client'
import { createHttpClient } from '../../../src/api/http'
import { createFetchStub } from '../support/fetchStub'

const BASE = 'http://localhost:8080'
const V1 = `${BASE}/api/v1`

interface Row {
  label: string
  call: (api: ApiClient) => Promise<unknown>
  method: string
  url: string
  body?: unknown
  publicRoute?: true
}

const WEEKLY = { windows: [{ weekday: 1, openTime: '08:00', closeTime: '20:00' }], dryRun: true }

const ROWS: Row[] = [
  { label: 'register', call: (a) => a.register({ username: 'u', password: 'p', displayName: 'd' }), method: 'POST', url: `${V1}/auth/register`, body: { username: 'u', password: 'p', displayName: 'd' }, publicRoute: true },
  { label: 'login', call: (a) => a.login({ username: 'u', password: 'p' }), method: 'POST', url: `${V1}/auth/login`, body: { username: 'u', password: 'p' }, publicRoute: true },
  { label: 'getMe', call: (a) => a.getMe(), method: 'GET', url: `${V1}/auth/me` },
  { label: 'getBookingRules', call: (a) => a.getBookingRules(), method: 'GET', url: `${V1}/config/booking-rules`, publicRoute: true },
  { label: 'listVenues', call: (a) => a.listVenues(), method: 'GET', url: `${V1}/venues` },
  { label: 'getVenueSlots', call: (a) => a.getVenueSlots(1, '2026-10-12'), method: 'GET', url: `${V1}/venues/1/slots?date=2026-10-12` },
  { label: 'listAnnouncements', call: (a) => a.listAnnouncements({ scope: 'VENUE', venueId: 1 }), method: 'GET', url: `${V1}/announcements?scope=VENUE&venueId=1` },
  { label: 'createReservation', call: (a) => a.createReservation({ resourceId: 1, serviceDate: '2026-10-12', startTime: '08:00' }), method: 'POST', url: `${V1}/reservations`, body: { resourceId: 1, serviceDate: '2026-10-12', startTime: '08:00' } },
  { label: 'listMyReservations', call: (a) => a.listMyReservations({ scope: 'CURRENT', page: 2 }), method: 'GET', url: `${V1}/reservations/me?scope=CURRENT&page=2` },
  { label: 'getReservation', call: (a) => a.getReservation(7), method: 'GET', url: `${V1}/reservations/7` },
  { label: 'cancelReservation', call: (a) => a.cancelReservation(7, { reason: 'r' }), method: 'POST', url: `${V1}/reservations/7/cancel`, body: { reason: 'r' } },
  { label: 'checkIn', call: (a) => a.checkIn(7), method: 'POST', url: `${V1}/reservations/7/check-in` },
  { label: 'checkOut', call: (a) => a.checkOut(7), method: 'POST', url: `${V1}/reservations/7/check-out` },
  { label: 'createRepair', call: (a) => a.createRepair({ venueId: 1, description: 'd' }), method: 'POST', url: `${V1}/repairs`, body: { venueId: 1, description: 'd' } },
  { label: 'listMyRepairs', call: (a) => a.listMyRepairs(), method: 'GET', url: `${V1}/repairs/me` },
  { label: 'adminListRepairs', call: (a) => a.adminListRepairs({ venueId: 1, status: 'SUBMITTED', page: 1 }), method: 'GET', url: `${V1}/admin/repairs?venueId=1&status=SUBMITTED&page=1` },
  { label: 'adminUpdateRepair', call: (a) => a.adminUpdateRepair(3, { status: 'RESOLVED', resultNote: 'ok' }), method: 'PATCH', url: `${V1}/admin/repairs/3`, body: { status: 'RESOLVED', resultNote: 'ok' } },
  { label: 'adminListVenues', call: (a) => a.adminListVenues(), method: 'GET', url: `${V1}/admin/venues` },
  { label: 'adminCreateVenue', call: (a) => a.adminCreateVenue({ name: 'n', venueType: 'OTHER' }), method: 'POST', url: `${V1}/admin/venues`, body: { name: 'n', venueType: 'OTHER' } },
  { label: 'adminUpdateVenue', call: (a) => a.adminUpdateVenue(2, { description: 'd' }), method: 'PATCH', url: `${V1}/admin/venues/2`, body: { description: 'd' } },
  { label: 'adminListResources', call: (a) => a.adminListResources(2), method: 'GET', url: `${V1}/admin/venues/2/resources` },
  { label: 'adminSetResourceCount', call: (a) => a.adminSetResourceCount(2, { count: 3, dryRun: true }), method: 'PUT', url: `${V1}/admin/venues/2/resource-count`, body: { count: 3, dryRun: true } },
  { label: 'adminUpdateResource', call: (a) => a.adminUpdateResource(5, { operationalStatus: 'MAINTENANCE' }), method: 'PATCH', url: `${V1}/admin/resources/5`, body: { operationalStatus: 'MAINTENANCE' } },
  { label: 'adminGetOccupancy', call: (a) => a.adminGetOccupancy(1, '2026-10-12'), method: 'GET', url: `${V1}/admin/venues/1/occupancy?date=2026-10-12` },
  { label: 'adminGetAvailabilityRules', call: (a) => a.adminGetAvailabilityRules(1), method: 'GET', url: `${V1}/admin/venues/1/availability-rules` },
  { label: 'adminReplaceWeeklyRules', call: (a) => a.adminReplaceWeeklyRules(1, WEEKLY), method: 'PUT', url: `${V1}/admin/venues/1/availability-rules/weekly`, body: WEEKLY },
  { label: 'adminAddClosure', call: (a) => a.adminAddClosure(1, { startDate: '2026-10-12', endDate: '2026-10-13' }), method: 'POST', url: `${V1}/admin/venues/1/closures`, body: { startDate: '2026-10-12', endDate: '2026-10-13' } },
  { label: 'adminRemoveClosure', call: (a) => a.adminRemoveClosure(4), method: 'DELETE', url: `${V1}/admin/closures/4` },
  { label: 'adminListReservations', call: (a) => a.adminListReservations({ venueId: 1, keyword: '张' }), method: 'GET', url: `${V1}/admin/reservations?venueId=1&keyword=${encodeURIComponent('张')}` },
  { label: 'adminCancelReservation', call: (a) => a.adminCancelReservation(7, { reason: 'r' }), method: 'POST', url: `${V1}/admin/reservations/7/cancel`, body: { reason: 'r' } },
  { label: 'adminReassignResource', call: (a) => a.adminReassignResource(7, { resourceId: 2, serviceDate: '2026-10-12', startTime: '08:00', reason: 'r' }), method: 'POST', url: `${V1}/admin/reservations/7/reassign-resource`, body: { resourceId: 2, serviceDate: '2026-10-12', startTime: '08:00', reason: 'r' } },
  { label: 'adminReassignUser', call: (a) => a.adminReassignUser(7, { userId: 2, reason: 'r' }), method: 'POST', url: `${V1}/admin/reservations/7/reassign-user`, body: { userId: 2, reason: 'r' } },
  { label: 'adminListAnnouncements', call: (a) => a.adminListAnnouncements({ scope: 'SYSTEM', status: 'ACTIVE' }), method: 'GET', url: `${V1}/admin/announcements?scope=SYSTEM&status=ACTIVE` },
  { label: 'adminCreateAnnouncement', call: (a) => a.adminCreateAnnouncement({ scope: 'SYSTEM', title: 't', content: 'c' }), method: 'POST', url: `${V1}/admin/announcements`, body: { scope: 'SYSTEM', title: 't', content: 'c' } },
  { label: 'adminArchiveAnnouncement', call: (a) => a.adminArchiveAnnouncement(9), method: 'DELETE', url: `${V1}/admin/announcements/9` },
  { label: 'adminListUsers', call: (a) => a.adminListUsers({ role: 'USER', pageSize: 50 }), method: 'GET', url: `${V1}/admin/users?role=USER&pageSize=50` },
  { label: 'adminCreateUser', call: (a) => a.adminCreateUser({ username: 'u', password: 'p', displayName: 'd', role: 'VENUE_ADMIN', venueIds: [1] }), method: 'POST', url: `${V1}/admin/users`, body: { username: 'u', password: 'p', displayName: 'd', role: 'VENUE_ADMIN', venueIds: [1] } },
  { label: 'adminUpdateUser', call: (a) => a.adminUpdateUser(3, { status: 'DISABLED' }), method: 'PATCH', url: `${V1}/admin/users/3`, body: { status: 'DISABLED' } },
  { label: 'adminSetVenueScope', call: (a) => a.adminSetVenueScope(3, { venueIds: [2, 3] }), method: 'PUT', url: `${V1}/admin/users/3/venue-scope`, body: { venueIds: [2, 3] } },
  { label: 'adminGetStatsOverview', call: (a) => a.adminGetStatsOverview({ dateFrom: '2026-10-01' }), method: 'GET', url: `${V1}/admin/stats/overview?dateFrom=2026-10-01` },
  { label: 'adminListLogs', call: (a) => a.adminListLogs({ action: 'CLOSURE_ADD' }), method: 'GET', url: `${V1}/admin/logs?action=CLOSURE_ADD` },
  { label: 'getDisplaySummary', call: (a) => a.getDisplaySummary(), method: 'GET', url: `${V1}/display/summary`, publicRoute: true },
]

function clientWith(token: string | null) {
  const stub = createFetchStub({ status: 200, json: {} })
  const api = createHttpClient({ baseUrl: BASE, getToken: () => token, fetchImpl: stub.fetchImpl })
  return { api, stub }
}

describe('http.ts 覆盖 docs/12 第 5 节全部接口', () => {
  it('表格行数与 ApiClient 方法数一致，且方法名一一对应', () => {
    expect(ROWS.map((row) => row.label).sort()).toEqual([...API_CLIENT_METHODS].sort())
    expect(ROWS).toHaveLength(42)
  })

  it.each(ROWS)('$label：方法、路径、查询与请求体', async (row) => {
    const { api, stub } = clientWith('tok')
    await row.call(api)
    expect(stub.calls).toHaveLength(1)
    const call = stub.calls[0]
    expect(call?.method).toBe(row.method)
    expect(call?.url).toBe(row.url)
    expect(call?.body === undefined ? undefined : JSON.parse(call.body)).toEqual(row.body)
  })
})

describe('http.ts 请求头', () => {
  it.each(ROWS.filter((row) => row.publicRoute === undefined))('$label 携带 Bearer Token', async (row) => {
    const { api, stub } = clientWith('abc')
    await row.call(api)
    expect(stub.calls[0]?.headers.Authorization).toBe('Bearer abc')
  })

  it.each(ROWS.filter((row) => row.publicRoute === true))('$label（公开接口）不携带 Token', async (row) => {
    const { api, stub } = clientWith('abc')
    await row.call(api)
    expect(stub.calls[0]?.headers.Authorization).toBeUndefined()
  })

  it('未登录（getToken 返回 null）时不带 Authorization', async () => {
    const { api, stub } = clientWith(null)
    await api.listVenues()
    expect(stub.calls[0]?.headers.Authorization).toBeUndefined()
  })

  it('每次请求都重新读取 Token', async () => {
    let token: string | null = null
    const stub = createFetchStub({ status: 200, json: [] })
    const api = createHttpClient({ baseUrl: BASE, getToken: () => token, fetchImpl: stub.fetchImpl })
    await api.listVenues()
    token = 'later'
    await api.listVenues()
    expect(stub.calls.map((call) => call.headers.Authorization)).toEqual([undefined, 'Bearer later'])
  })

  it('有请求体时带 JSON Content-Type，无请求体时不带', async () => {
    const { api, stub } = clientWith('t')
    await api.createReservation({ resourceId: 1, serviceDate: '2026-10-12', startTime: '08:00' })
    await api.checkIn(1)
    expect(stub.calls[0]?.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(stub.calls[1]?.headers['Content-Type']).toBeUndefined()
    expect(stub.calls[1]?.body).toBeUndefined()
  })
})

describe('http.ts 响应与地址', () => {
  it('204 响应返回 undefined', async () => {
    const stub = createFetchStub({ status: 204 })
    const api = createHttpClient({ baseUrl: BASE, getToken: () => 't', fetchImpl: stub.fetchImpl })
    await expect(api.adminRemoveClosure(1)).resolves.toBeUndefined()
  })

  it('200 响应体直接是资源对象，不剥外层信封', async () => {
    const stub = createFetchStub({ status: 200, json: { id: 1, name: '网球馆' } })
    const api = createHttpClient({ baseUrl: BASE, getToken: () => 't', fetchImpl: stub.fetchImpl })
    await expect(api.getMe()).resolves.toEqual({ id: 1, name: '网球馆' })
  })

  it('baseUrl 末尾的斜杠不会造成双斜杠；undefined 查询参数被省略', async () => {
    const stub = createFetchStub({ status: 200, json: {} })
    const api = createHttpClient({ baseUrl: `${BASE}/`, getToken: () => 't', fetchImpl: stub.fetchImpl })
    await api.listMyReservations({ scope: undefined, page: 1 })
    expect(stub.calls[0]?.url).toBe(`${V1}/reservations/me?page=1`)
  })

  it('cancelReservation 未传请求体时发送空对象 {}', async () => {
    const { api, stub } = clientWith('t')
    await api.cancelReservation(5)
    expect(stub.calls[0]?.body).toBe('{}')
  })
})
