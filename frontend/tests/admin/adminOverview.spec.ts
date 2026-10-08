// FE-5 P1：概览只展示接口返回的值。
import { describe, expect, it } from 'vitest'

import type { StatsOverview } from '../../src/api/typesSection5'
import { createAdminOverview } from '../../src/composables/adminOverview'
import { buildDaily, buildMetrics, formatRate, rangeText } from '../../src/utils/adminOverviewDisplay'
import { loginAdmin, spyOn } from './harness'

function stats(overrides: Partial<StatsOverview> = {}): StatsOverview {
  return {
    dateFrom: '2026-10-06', dateTo: '2026-10-12', reservationCount: 5, activeOccupiedSlots: 3, openSlots: 12,
    utilizationRate: 0.25, currentInUse: 1, userCancelCount: 2, adminCancelCount: 1, noShowRate: null,
    byVenue: [], daily: [
      { date: '2026-10-11', reservationCount: 2, utilizationRate: null },
      { date: '2026-10-12', reservationCount: 4, utilizationRate: 0.5 },
    ],
    ...overrides,
  }
}

describe('P1 格式化', () => {
  it('八项指标按固定顺序，null 比率显示“—”', () => {
    expect(buildMetrics(stats()).map((metric) => [metric.label, metric.value])).toEqual([
      ['预约量', '5'], ['有效占用时段数', '3'], ['开放时段数', '12'], ['利用率', '25.0%'],
      ['当前使用', '1'], ['用户取消量', '2'], ['管理员取消量', '1'], ['未到场率', '—'],
    ])
    expect(formatRate(null)).toBe('—')
    expect(formatRate(0)).toBe('0.0%')
    expect(formatRate(1)).toBe('100.0%')
  })

  it('每日趋势逐日取接口值；柱条宽度只相对本区间最大预约量', () => {
    expect(buildDaily(stats())).toEqual([
      { date: '2026-10-11', countText: '2', rateText: '—', barPercent: 50 },
      { date: '2026-10-12', countText: '4', rateText: '50.0%', barPercent: 100 },
    ])
    expect(buildDaily(stats({ daily: [{ date: '2026-10-12', reservationCount: 0, utilizationRate: null }] }))[0]?.barPercent).toBe(0)
    expect(rangeText(stats())).toBe('统计区间：2026-10-06 至 2026-10-12')
  })

  it('X6：不重新计算——利用率与计数互相矛盾时，按接口给的利用率显示', () => {
    const odd = stats({ activeOccupiedSlots: 1, openSlots: 100, utilizationRate: 0.5 })

    expect(buildMetrics(odd).find((metric) => metric.key === 'utilizationRate')?.value).toBe('50.0%')
  })
})

describe('P1 board', () => {
  it('以所选场馆调用 adminGetStatsOverview，不传日期（缺省区间由后端给）', async () => {
    const ctx = await loginAdmin('admin_tennis')
    const { client, calls } = spyOn(ctx.api)
    const board = createAdminOverview({ api: client, call: ctx.call }, 1)
    await board.load()

    expect(calls).toEqual([{ method: 'adminGetStatsOverview', args: [{ venueId: 1 }] }])
    expect(board.stats.value?.dateFrom).toBe('2026-10-06')
    expect(board.stats.value?.dateTo).toBe('2026-10-12')
    expect(board.metrics.value).toHaveLength(8)
    expect(board.daily.value.map((day) => day.date)).toHaveLength(7)
    expect(board.error.value).toBeNull()
  })

  it('越权场馆：显示 FORBIDDEN_SCOPE 文案，没有数据', async () => {
    const ctx = await loginAdmin('admin_tennis')
    const board = createAdminOverview({ api: ctx.api, call: ctx.call }, 2)
    await board.load()

    expect(board.error.value).toBe('无权操作该场馆')
    expect(board.stats.value).toBeNull()
  })
})
