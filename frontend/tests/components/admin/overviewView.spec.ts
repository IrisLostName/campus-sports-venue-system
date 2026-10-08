// FE-5 P1：概览页挂载后的渲染结果（ACC-M2-07 的“概览”）。
import { describe, expect, it, vi } from 'vitest'

import { content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('P1 概览页', () => {
  it('显示八项指标和七天趋势，数值与接口返回一致', async () => {
    const { root, h } = await openAdminApp('/venue-admin')
    const expected = await h.api.adminGetStatsOverview({ venueId: 1 })

    const main = content(root)
    expect(main.get('h1').text()).toBe('概览')
    expect(main.findAll('[data-metric]').map((card) => card.get('.label').text())).toEqual([
      '预约量', '有效占用时段数', '开放时段数', '利用率', '当前使用', '用户取消量', '管理员取消量', '未到场率',
    ])
    expect(main.get('[data-metric="reservationCount"] .value').text()).toBe(String(expected.reservationCount))
    expect(main.get('[data-metric="openSlots"] .value').text()).toBe(String(expected.openSlots))
    expect(main.get('.range').text()).toBe(`统计区间：${expected.dateFrom} 至 ${expected.dateTo}`)
    expect(main.findAll('section[aria-label="每日趋势"] tbody tr')).toHaveLength(expected.daily.length)
    expect(main.findAll('section[aria-label="每日趋势"] tbody tr').map((row) => row.findAll('td')[0]?.text()))
      .toEqual(expected.daily.map((day) => day.date))
  })

  it('X6：利用率与计数互相矛盾时显示接口给的利用率；null 显示“—”', async () => {
    const { root } = await openAdminApp('/venue-admin', {
      wrap: (api) => ({
        ...api,
        adminGetStatsOverview: async (query) => ({
          ...(await api.adminGetStatsOverview(query)),
          activeOccupiedSlots: 1, openSlots: 100, utilizationRate: 0.5, noShowRate: null,
        }),
      }),
    })

    const main = content(root)
    expect(main.get('[data-metric="utilizationRate"] .value').text()).toBe('50.0%')
    expect(main.get('[data-metric="noShowRate"] .value').text()).toBe('—')
    expect(main.get('[data-metric="activeOccupiedSlots"] .value').text()).toBe('1')
  })

  it('接口失败：显示错误提示，没有指标', async () => {
    const { root } = await openAdminApp('/venue-admin', {
      wrap: (api) => ({ ...api, adminGetStatsOverview: () => Promise.reject(new Error('boom')) }),
    })

    expect(content(root).get('[role="alert"]').text()).toBe('服务器开小差了，请稍后再试')
    expect(content(root).find('[data-metric]').exists()).toBe(false)
  })
})
