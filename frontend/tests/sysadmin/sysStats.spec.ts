// FE-6 G5：全局统计。不带 venueId = 全局；日期区间可选；byVenue 与指标只展示接口值，不重新计算。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { StatsOverview } from '../../src/api/typesSection5'
import { createSysStats } from '../../src/composables/sysStats'
import { buildByVenue } from '../../src/utils/sysStatsDisplay'
import { loginAdmin, spyOn } from '../admin/harness'

function stats(overrides: Partial<StatsOverview> = {}): StatsOverview {
  return {
    dateFrom: '2026-10-06', dateTo: '2026-10-12', reservationCount: 9, activeOccupiedSlots: 5, openSlots: 20,
    utilizationRate: 0.25, currentInUse: 1, userCancelCount: 2, adminCancelCount: 1, noShowRate: null,
    byVenue: [
      { venueId: 1, venueName: '网球馆', reservationCount: 6, utilizationRate: 0.3333 },
      { venueId: 2, venueName: '羽毛球馆', reservationCount: 3, utilizationRate: null },
    ],
    daily: [{ date: '2026-10-12', reservationCount: 9, utilizationRate: 0.25 }],
    ...overrides,
  }
}

describe('G5 展示口径', () => {
  it('byVenue 逐行显示接口的预约量与利用率；null 显示“—”；比率保留一位小数', () => {
    expect(buildByVenue(stats())).toEqual([
      { venueId: 1, venueName: '网球馆', countText: '6', rateText: '33.3%' },
      { venueId: 2, venueName: '羽毛球馆', countText: '3', rateText: '—' },
    ])
  })

  it('不重新计算：各场馆预约量之和不等于总预约量时，两者都照接口显示', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminGetStatsOverview: () => Promise.resolve(stats({ reservationCount: 100 })) }
    const board = createSysStats({ api, call: ctx.call })
    await board.load()

    expect(board.metrics.value.find((metric) => metric.key === 'reservationCount')?.value).toBe('100')
    expect(board.byVenue.value.map((row) => row.countText)).toEqual(['6', '3'])
    expect(board.metrics.value.find((metric) => metric.key === 'noShowRate')?.value).toBe('—')
  })
})

describe('G5 全局统计查询', () => {
  it('缺省：不带 venueId，也不带日期，区间由接口决定；byVenue 含全部三个场馆', async () => {
    const ctx = await loginAdmin('sysadmin')
    const spy = spyOn(ctx.api)
    const board = createSysStats({ api: spy.client, call: ctx.call })
    await board.load()

    expect(spy.calls.filter((call) => call.method === 'adminGetStatsOverview').map((call) => call.args)).toEqual([[{}]])
    expect(board.byVenue.value.map((row) => row.venueName)).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(board.range.value).toBe('统计区间：2026-10-06 至 2026-10-12')
    expect(board.daily.value).toHaveLength(7)
  })

  it('选了日期区间：只带 dateFrom / dateTo，仍不带 venueId', async () => {
    const ctx = await loginAdmin('sysadmin')
    const spy = spyOn(ctx.api)
    const board = createSysStats({ api: spy.client, call: ctx.call })
    board.filters.dateFrom = '2026-10-10'
    board.filters.dateTo = '2026-10-12'
    await board.load()

    expect(spy.calls.filter((call) => call.method === 'adminGetStatsOverview').map((call) => call.args)).toEqual([[{ dateFrom: '2026-10-10', dateTo: '2026-10-12' }]])
    expect(board.range.value).toBe('统计区间：2026-10-10 至 2026-10-12')
    expect(board.daily.value.map((row) => row.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
  })

  it('接口拒绝（区间过长）：显示接口文案，保留上一次的数据', async () => {
    const ctx = await loginAdmin('sysadmin')
    const board = createSysStats({ api: ctx.api, call: ctx.call })
    await board.load()
    board.filters.dateFrom = '2020-01-01'
    await board.load()

    expect(board.error.value).toBe('请求参数不合法')
    expect(board.stats.value).not.toBeNull()
  })

  it('X1：TOKEN_EXPIRED 回到登录页，不展示错误', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminGetStatsOverview: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }
    const board = createSysStats({ api, call: ctx.call })
    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.error.value).toBeNull()
  })
})
