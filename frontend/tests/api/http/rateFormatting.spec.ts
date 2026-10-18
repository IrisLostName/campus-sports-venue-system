// BE-8 K5（BE-7 N3）：后端把比率序列化为 0.0、1.0 或科学计数法（如 2.568493150684931E-4），也可能为 null。
// 以替身 fetch 返回与后端逐字相同的 JSON 文本，经 http 适配器解析后交给页面使用的格式化函数，核对百分比与“—”。
import { describe, expect, it } from 'vitest'

import { createHttpClient } from '../../../src/api/http'
import { buildDaily, buildMetrics } from '../../../src/utils/adminOverviewDisplay'
import { buildDisplayBoardView } from '../../../src/utils/displayModel'
import { buildByVenue } from '../../../src/utils/sysStatsDisplay'
import { createFetchStub } from '../support/fetchStub'

// 与后端 Jackson 输出同形的原始文本（不经 JSON.stringify，保留 0.0、1.0 与 E 记数法的写法）。
const OVERVIEW_TEXT = `{"dateFrom":"2026-10-12","dateTo":"2026-10-18","reservationCount":3,
"activeOccupiedSlots":2,"openSlots":7788,"utilizationRate":2.568493150684931E-4,"currentInUse":0,
"userCancelCount":0,"adminCancelCount":1,"noShowRate":1.0,
"byVenue":[{"venueId":1,"venueName":"网球馆","reservationCount":3,"utilizationRate":2.568493150684931E-2},
{"venueId":2,"venueName":"羽毛球馆","reservationCount":0,"utilizationRate":0.0},
{"venueId":3,"venueName":"游泳馆","reservationCount":0,"utilizationRate":null}],
"daily":[{"date":"2026-10-12","reservationCount":0,"utilizationRate":null},
{"date":"2026-10-13","reservationCount":3,"utilizationRate":1.0}]}`

const SUMMARY_TEXT = `{"generatedAt":"2026-10-18T10:00:00","todayReservationCount":1,"currentInUse":0,
"todayUtilizationRate":2.568493150684931E-4,"venues":[],"resources":[],"weekTrend":[],"notices":[]}`

function clientReturning(text: string) {
  const stub = createFetchStub({ status: 200, text })
  return createHttpClient({ baseUrl: 'http://localhost:8080', getToken: () => 'token', fetchImpl: stub.fetchImpl })
}

function valueOf(metrics: { key: string; value: string }[], key: string): string | undefined {
  return metrics.find((metric) => metric.key === key)?.value
}

describe('BE-8 K5：后端形态的比率经 http 适配器后的显示', () => {
  it('管理端概览：科学计数法、1.0 与 null 分别显示为百分比与“—”', async () => {
    const stats = await clientReturning(OVERVIEW_TEXT).adminGetStatsOverview()
    const metrics = buildMetrics(stats)
    expect(valueOf(metrics, 'utilizationRate')).toBe('0.0%')
    expect(valueOf(metrics, 'noShowRate')).toBe('100.0%')
    expect(buildDaily(stats).map((day) => day.rateText)).toEqual(['—', '100.0%'])
  })

  it('全局统计按场馆：2.568493150684931E-2 显示 2.6%，0.0 显示 0.0%，null 显示“—”', async () => {
    const stats = await clientReturning(OVERVIEW_TEXT).adminGetStatsOverview()
    expect(buildByVenue(stats).map((venue) => venue.rateText)).toEqual(['2.6%', '0.0%', '—'])
  })

  it('大屏：今日利用率为科学计数法的小数时显示 0.0%', async () => {
    const view = buildDisplayBoardView(await clientReturning(SUMMARY_TEXT).getDisplaySummary())
    expect(valueOf(view.metrics, 'utilization')).toBe('0.0%')
  })

  it('大屏：null 显示“—”，1.0 显示 100.0%', async () => {
    const nullText = SUMMARY_TEXT.replace('2.568493150684931E-4', 'null')
    const fullText = SUMMARY_TEXT.replace('2.568493150684931E-4', '1.0')
    expect(valueOf(buildDisplayBoardView(await clientReturning(nullText).getDisplaySummary()).metrics, 'utilization')).toBe('—')
    expect(valueOf(buildDisplayBoardView(await clientReturning(fullText).getDisplaySummary()).metrics, 'utilization')).toBe('100.0%')
  })
})
