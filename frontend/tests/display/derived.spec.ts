// UI-2a-rulings 第 0 节第 1 条：“开放场地 X/Y”、进度条与“场地实时状态”环形图只由 DisplaySummary 的现有字段派生。
import { describe, expect, it } from 'vitest'

import { areaPath, donutSegments, smoothLinePath } from '../../src/components/display/chartGeometry'
import { buildDisplayBoardView } from '../../src/utils/displayModel'
import { createHarness, setTime, TOMORROW } from '../api/support/harness'
import { makeSummary } from './support'

describe('开放场地 X/Y', () => {
  it('各场馆 resourceOpen、resourceTotal 分别求和（手工数据：2+0 / 2+1）', () => {
    expect(buildDisplayBoardView(makeSummary()).openResources).toEqual({ open: 2, total: 3, text: '2/3' })
  })

  it('mock：一个场地设为维护、一个停用后，开放数少 2，X/Y 始终等于接口字段的合计', async () => {
    const h = createHarness()
    h.logout()
    const before = buildDisplayBoardView(await h.api.getDisplaySummary()).openResources
    await h.loginAs('sysadmin')
    await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await h.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    h.logout()
    const summary = await h.api.getDisplaySummary()
    const view = buildDisplayBoardView(summary)
    expect(view.openResources.open).toBe(summary.venues.reduce((sum, venue) => sum + venue.resourceOpen, 0))
    expect(view.openResources.total).toBe(summary.venues.reduce((sum, venue) => sum + venue.resourceTotal, 0))
    expect(view.openResources.open).toBe(before.open - 2)
  })

  it('没有场馆时为 0/0', () => {
    expect(buildDisplayBoardView(makeSummary({ venues: [], resources: [] })).openResources.text).toBe('0/0')
  })
})

describe('场馆进度条：当前已预约 ÷ 开放场地', () => {
  it('1/2 = 0.5；开放为 0 时为 0（不出现 NaN）', () => {
    expect(buildDisplayBoardView(makeSummary()).venues.map((venue) => venue.reservedRatio)).toEqual([0.5, 0])
  })

  it('不超过 1', () => {
    const summary = makeSummary({
      venues: [{ venueId: 1, venueName: '网球馆', operationalStatus: 'OPEN', userBookingEnabled: true,
        resourceTotal: 2, resourceOpen: 1, resourcesReservedNow: 3 }],
    })
    expect(buildDisplayBoardView(summary).venues[0]?.reservedRatio).toBe(1)
  })
})

describe('场地实时状态计数', () => {
  it('五种状态按固定顺序列出（数量可为 0），合计等于场地总数；不计入不属于任何场馆的场地', () => {
    const summary = makeSummary()
    summary.resources.push({ venueId: 99, resourceId: 50, resourceName: '孤儿场地', state: 'IN_USE' })
    const view = buildDisplayBoardView(summary)
    expect(view.stateBreakdown.map((item) => `${item.state}:${item.label}:${item.count}`)).toEqual([
      'FREE:空闲:1', 'RESERVED:已预约:1', 'IN_USE:使用中:0', 'MAINTENANCE:维护:1', 'DISABLED:停用:0',
    ])
    expect(view.resourceCount).toBe(3)
  })

  it('mock：五种状态各有场地时，计数与接口给出的 state 一致', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await h.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    setTime(h, TOMORROW, '08:00')
    await h.loginAs('zhangsan')
    await h.api.checkIn(1)
    h.logout()
    const summary = await h.api.getDisplaySummary()
    const view = buildDisplayBoardView(summary)
    for (const item of view.stateBreakdown) {
      expect(item.count, item.state).toBe(summary.resources.filter((resource) => resource.state === item.state).length)
      expect(item.count, item.state).toBeGreaterThan(0)
    }
    expect(view.resourceCount).toBe(summary.resources.length)
  })
})

describe('趋势坐标与刻度', () => {
  it('x 取每列中点，y = 100 − 柱高；刻度只取整数（0、峰值的一半、峰值）', () => {
    const days = [4, 2, 1, 0, 4, 3, 0].map((count, index) => ({ date: `2026-10-0${index + 1}`, reservationCount: count }))
    const view = buildDisplayBoardView(makeSummary({ weekTrend: days }))
    expect(view.trend.map((bar) => Math.round(bar.x * 100) / 100)).toEqual([7.14, 21.43, 35.71, 50, 64.29, 78.57, 92.86])
    expect(view.trend.map((bar) => bar.y)).toEqual([0, 50, 75, 100, 0, 25, 100])
    expect(view.trendTicks).toEqual([{ value: 0, percent: 0 }, { value: 2, percent: 50 }, { value: 4, percent: 100 }])
    const odd = buildDisplayBoardView(makeSummary({ weekTrend: [{ date: '2026-10-01', reservationCount: 3 }] }))
    expect(odd.trendTicks).toEqual([{ value: 0, percent: 0 }, { value: 3, percent: 100 }])
    expect(buildDisplayBoardView(makeSummary()).trendTicks).toEqual([{ value: 0, percent: 0 }])
  })

  it('平滑曲线经过每个点、不越出 0–100；面积闭合到横轴', () => {
    const points = [{ x: 10, y: 0 }, { x: 30, y: 100 }, { x: 50, y: 0 }, { x: 70, y: 100 }]
    const line = smoothLinePath(points)
    const numbers = (line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    expect(line.startsWith('M10 0 ')).toBe(true)
    expect(line).toContain(' 30 100')
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100)
    expect(areaPath(points).endsWith('L70 100 L10 100 Z')).toBe(true)
    expect(smoothLinePath([])).toBe('')
  })

  it('环形图弧段：按份额首尾相接，数量为 0 的不画；总数为 0 时没有弧段', () => {
    const segments = donutSegments([3, 0, 1], (count) => count)
    expect(segments.map((segment) => [segment.item, segment.dashArray, segment.dashOffset])).toEqual([
      [3, '75 25', 25], [1, '25 75', -50],
    ])
    expect(donutSegments([0, 0], (count) => count)).toEqual([])
  })
})
