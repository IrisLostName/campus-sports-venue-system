// 统计总览与大屏聚合（docs/12 第 5.10 节；口径 docs/03 第 4.5、8 节；规划裁决 A14）。
import { describe, expect, it } from 'vitest'

import { book, createHarness, expectApiError, travel, TODAY, TOMORROW, type Harness } from '../support/harness'

// 每天的开放时段：网球馆 4 场地 × 8 = 32，羽毛球馆 6 × 8 = 48，游泳馆 6 × 8 = 48。
const PER_DAY = { tennis: 32, badminton: 48, pool: 48 }

async function as(username: string): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('统计总览：区间与口径', () => {
  it('缺省区间为 [今天−6, 今天]；开放时段数 = 区间天数 × 每天时段数', async () => {
    const h = await as('sysadmin')
    const stats = await h.api.adminGetStatsOverview()
    expect(stats).toMatchObject({ dateFrom: '2026-10-06', dateTo: TODAY, reservationCount: 2, activeOccupiedSlots: 0 })
    expect(stats.openSlots).toBe(7 * (PER_DAY.tennis + PER_DAY.badminton + PER_DAY.pool))
    expect(stats.utilizationRate).toBe(0)
    expect(stats.daily.map((d) => d.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', TODAY])
  })

  it('利用率 = 有效占用时段数 ÷ 开放时段数（占用按使用日期归入区间）', async () => {
    const h = await as('sysadmin')
    const stats = await h.api.adminGetStatsOverview({ venueId: 1, dateFrom: TODAY, dateTo: TOMORROW })
    expect(stats).toMatchObject({ activeOccupiedSlots: 2, openSlots: 2 * PER_DAY.tennis })
    expect(stats.utilizationRate).toBeCloseTo(2 / 64)
    expect(stats.daily).toEqual([
      { date: TODAY, reservationCount: 2, utilizationRate: 0 },
      { date: TOMORROW, reservationCount: 0, utilizationRate: 2 / 32 },
    ])
    expect(stats.byVenue).toEqual([{ venueId: 1, venueName: '网球馆', reservationCount: 2, utilizationRate: 2 / 64 }])
  })

  it('取消的预约不计入占用，用户取消与管理员取消分别统计', async () => {
    const h = await as('zhangsan')
    await h.api.cancelReservation(1)
    await h.loginAs('admin_tennis')
    await h.api.adminCancelReservation(2, { reason: '维修' })
    const stats = await h.api.adminGetStatsOverview({ dateFrom: TODAY, dateTo: TOMORROW })
    expect(stats).toMatchObject({ reservationCount: 2, activeOccupiedSlots: 0, userCancelCount: 1, adminCancelCount: 1 })
  })

  it('开放时段数为 0 时 utilizationRate 为 null；未到场率分母为 0 时为 null', async () => {
    const h = await as('sysadmin')
    await h.api.adminReplaceWeeklyRules(1, { windows: [], onExistingReservations: 'KEEP' })
    const stats = await h.api.adminGetStatsOverview({ venueId: 1 })
    expect(stats).toMatchObject({ openSlots: 0, utilizationRate: null, noShowRate: null })
    expect(stats.byVenue[0]?.utilizationRate).toBeNull()
    expect(stats.daily.every((d) => d.utilizationRate === null)).toBe(true)
  })

  it('未到场率 = NO_SHOW ÷（NO_SHOW + COMPLETED）', async () => {
    const h = await as('zhangsan')
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    await travel(h, `${TOMORROW}T12:00:00`, 'sysadmin')
    const stats = await h.api.adminGetStatsOverview({ dateFrom: TOMORROW, dateTo: TOMORROW })
    expect(stats.noShowRate).toBe(0.5)
  })

  it('当前使用 = 当前时刻在预约区间内且已签到未签退', async () => {
    const h = await as('zhangsan')
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    await h.loginAs('sysadmin')
    expect((await h.api.adminGetStatsOverview()).currentInUse).toBe(1)
    h.clock.set(`${TOMORROW}T09:30:00`)
    expect((await h.api.adminGetStatsOverview()).currentInUse).toBe(0)
  })
})

describe('统计总览：范围与校验', () => {
  it('场馆管理员不带 venueId 时聚合其授权场馆；越权 venueId FORBIDDEN_SCOPE', async () => {
    const h = await as('admin_pool')
    const stats = await h.api.adminGetStatsOverview({ dateFrom: TODAY, dateTo: TODAY })
    expect(stats.byVenue.map((v) => v.venueId)).toEqual([2, 3])
    expect(stats.openSlots).toBe(PER_DAY.badminton + PER_DAY.pool)
    await expectApiError(h.api.adminGetStatsOverview({ venueId: 1 }), 'FORBIDDEN_SCOPE')
  })

  it('日期错误或区间颠倒 VALIDATION_ERROR；场馆不存在 NOT_FOUND；普通用户 FORBIDDEN', async () => {
    const h = await as('sysadmin')
    await expectApiError(h.api.adminGetStatsOverview({ dateFrom: TOMORROW, dateTo: TODAY }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminGetStatsOverview({ dateFrom: 'x' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminGetStatsOverview({ venueId: 99 }), 'NOT_FOUND')
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminGetStatsOverview(), 'FORBIDDEN')
  })
})

describe('大屏聚合（GET /display/summary，公开）', () => {
  it('无需 Token；场馆、场地、7 天趋势、系统提示', async () => {
    const h = createHarness()
    const summary = await h.api.getDisplaySummary()
    expect(summary).toMatchObject({ generatedAt: `${TODAY}T07:00:00`, todayReservationCount: 2, currentInUse: 0 })
    expect(summary.todayUtilizationRate).toBe(0)
    expect(summary.venues.map((v) => [v.venueName, v.resourceTotal, v.resourceOpen, v.resourcesReservedNow, v.userBookingEnabled]))
      .toEqual([['网球馆', 4, 4, 0, true], ['羽毛球馆', 6, 6, 0, false], ['游泳馆', 6, 6, 0, false]])
    expect(summary.resources).toHaveLength(16)
    expect(summary.resources.every((r) => r.state === 'FREE')).toBe(true)
    expect(summary.weekTrend).toHaveLength(7)
    expect(summary.weekTrend[6]).toEqual({ date: TODAY, reservationCount: 2 })
    expect(summary.weekTrend.slice(0, 6).every((day) => day.reservationCount === 0)).toBe(true)
    expect(summary.notices).toEqual([{ id: 1, title: '欢迎使用校园场馆预约系统' }])
  })

  it('不含任何个人信息', async () => {
    const h = createHarness()
    const text = JSON.stringify(await h.api.getDisplaySummary())
    for (const secret of ['张三', '李四', 'zhangsan', 'lisi', 'username', 'userId', 'displayName']) {
      expect(text).not.toContain(secret)
    }
  })

  it('系统提示最多 5 条，按发布时间倒序，只含系统公告', async () => {
    const h = await as('sysadmin')
    for (let index = 1; index <= 6; index += 1) {
      h.clock.advanceMinutes(1)
      await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: `公告${index}`, content: 'c' })
    }
    await h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 1, title: '场馆公告', content: 'c' })
    const notices = (await h.api.getDisplaySummary()).notices.map((n) => n.title)
    expect(notices).toEqual(['公告6', '公告5', '公告4', '公告3', '公告2'])
  })
})

describe('大屏与管理端口径一致（03 第 8 节末句）', () => {
  it('种子下今天的预约量：大屏 todayReservationCount 等于管理端同一区间的 reservationCount', async () => {
    const h = await as('sysadmin')
    const overview = await h.api.adminGetStatsOverview({ dateFrom: TODAY, dateTo: TODAY })
    const summary = await h.api.getDisplaySummary()
    expect(summary.todayReservationCount).toBe(overview.reservationCount)
    expect(summary.todayReservationCount).toBe(2)
  })

  it('预约量按创建日期、含已取消：取消与跨天创建后，大屏 todayReservationCount 与 weekTrend 仍等于管理端', async () => {
    const h = await as('zhangsan')
    await h.api.cancelReservation(1)
    await travel(h, `${TOMORROW}T09:00:00`, 'lisi')
    await book(h.api, 3, TOMORROW, '14:00')
    await book(h.api, 4, TOMORROW, '15:30')
    await h.loginAs('sysadmin')
    const from = '2026-10-07'
    const overview = await h.api.adminGetStatsOverview({ dateFrom: from, dateTo: TOMORROW })
    const summary = await h.api.getDisplaySummary()
    expect(summary.weekTrend.map((day) => day.date)).toEqual(overview.daily.map((day) => day.date))
    expect(summary.weekTrend.map((day) => day.reservationCount)).toEqual(overview.daily.map((day) => day.reservationCount))
    expect(summary.weekTrend.at(-1)).toEqual({ date: TOMORROW, reservationCount: 2 })
    expect(summary.weekTrend.at(-2)).toEqual({ date: TODAY, reservationCount: 2 })
    const today = await h.api.adminGetStatsOverview({ dateFrom: TOMORROW, dateTo: TOMORROW })
    expect(summary.todayReservationCount).toBe(today.reservationCount)
  })

  it('利用率与当前使用：大屏与管理端同一区间取值相同', async () => {
    const h = await as('zhangsan')
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    await h.loginAs('sysadmin')
    const overview = await h.api.adminGetStatsOverview({ dateFrom: TOMORROW, dateTo: TOMORROW })
    const summary = await h.api.getDisplaySummary()
    expect(summary.todayUtilizationRate).toBe(overview.utilizationRate)
    expect(summary.currentInUse).toBe(overview.currentInUse)
    expect(summary.currentInUse).toBe(1)
  })
})

describe('场地实时状态（03 第 4.5 节）', () => {
  const stateOf = async (h: Harness, resourceId: number) =>
    (await h.api.getDisplaySummary()).resources.find((r) => r.resourceId === resourceId)?.state

  it('紧接着的下一时段有预约 → RESERVED；其他时段的预约不算', async () => {
    const h = createHarness()
    h.clock.set(`${TOMORROW}T07:50:00`)
    expect(await stateOf(h, 1)).toBe('RESERVED')
    expect(await stateOf(h, 2)).toBe('FREE')
  })

  it('当前时段有未签到预约 → RESERVED；其下一时段的预约同样 RESERVED', async () => {
    const h = createHarness()
    h.clock.set(`${TOMORROW}T08:10:00`)
    expect(await stateOf(h, 1)).toBe('RESERVED')
    expect(await stateOf(h, 2)).toBe('RESERVED')
    expect((await h.api.getDisplaySummary()).venues[0]?.resourcesReservedNow).toBe(2)
  })

  it('已签到未签退 → IN_USE，计入 currentInUse 与 resourcesReservedNow', async () => {
    const h = createHarness()
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    expect(await stateOf(h, 1)).toBe('IN_USE')
    const summary = await h.api.getDisplaySummary()
    expect(summary.currentInUse).toBe(1)
    expect(summary.venues[0]?.resourcesReservedNow).toBe(2)
  })

  it('MAINTENANCE：场地维护、场馆关闭、今天落在关闭规则内；DISABLED 优先于它们', async () => {
    const h = await as('sysadmin')
    await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    expect(await stateOf(h, 3)).toBe('MAINTENANCE')
    await h.api.adminAddClosure(1, { startDate: TODAY, endDate: TODAY, resourceId: 4 })
    expect(await stateOf(h, 4)).toBe('MAINTENANCE')
    await h.api.adminUpdateVenue(2, { operationalStatus: 'CLOSED' })
    expect(await stateOf(h, 5)).toBe('MAINTENANCE')
    await h.api.adminUpdateResource(5, { operationalStatus: 'DISABLED' })
    expect(await stateOf(h, 5)).toBe('DISABLED')
  })
})
