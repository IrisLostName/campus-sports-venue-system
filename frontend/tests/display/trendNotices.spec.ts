// 大屏趋势与系统提示（FE-7-rulings D2、D5）。
import { describe, expect, it } from 'vitest'

import { buildDisplayBoardView, NOTICE_LIMIT } from '../../src/utils/displayModel'
import { createHarness, TODAY } from '../api/support/harness'
import { makeSummary } from './support'

describe('本周趋势（近 7 天含今天）', () => {
  it('7 根柱：日期标签为 MM-DD，今天在最后，柱高按最大值折算', async () => {
    const h = createHarness()
    const view = buildDisplayBoardView(await h.api.getDisplaySummary())
    expect(view.trend.map((bar) => bar.date)).toEqual([
      '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', TODAY,
    ])
    expect(view.trend.map((bar) => bar.label)).toEqual(['10-06', '10-07', '10-08', '10-09', '10-10', '10-11', '10-12'])
    expect(view.trend.map((bar) => bar.count)).toEqual([0, 0, 0, 0, 0, 0, 2])
    expect(view.trend.map((bar) => bar.heightPercent)).toEqual([0, 0, 0, 0, 0, 0, 100])
  })

  it('柱高 = 当日预约量 ÷ 最大值；全部为 0 时柱高为 0（不出现 NaN）', () => {
    const days = [4, 2, 1, 0, 4, 3, 0].map((count, index) => ({ date: `2026-10-0${index + 1}`, reservationCount: count }))
    const view = buildDisplayBoardView(makeSummary({ weekTrend: days }))
    expect(view.trend.map((bar) => bar.heightPercent)).toEqual([100, 50, 25, 0, 100, 75, 0])
    const flat = buildDisplayBoardView(makeSummary({ weekTrend: days.map((day) => ({ ...day, reservationCount: 0 })) }))
    expect(flat.trend.every((bar) => bar.heightPercent === 0)).toBe(true)
  })
})

describe('系统提示（最多 5 条）', () => {
  it('mock：发布 7 条系统公告后接口只给 5 条，页面逐条显示标题', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    for (let index = 1; index <= 7; index += 1) {
      await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: `公告${index}`, content: `内容${index}` })
    }
    const view = buildDisplayBoardView(await h.api.getDisplaySummary())
    expect(view.notices).toHaveLength(NOTICE_LIMIT)
    expect(view.notices.every((notice) => notice.title.length > 0)).toBe(true)
  })

  it('接口若给出多于 5 条，页面也只取前 5 条', () => {
    const notices = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: `提示${index + 1}` }))
    const view = buildDisplayBoardView(makeSummary({ notices }))
    expect(view.notices.map((notice) => notice.title)).toEqual(['提示1', '提示2', '提示3', '提示4', '提示5'])
  })

  it('没有系统公告时 notices 为空数组', () => {
    expect(buildDisplayBoardView(makeSummary({ notices: [] })).notices).toEqual([])
  })
})
