// FE-7 运营大屏（FE-7-rulings D1–D4；ACC-M2-09）：挂载整页，断言指标、场馆分组、场地状态、趋势、提示与只读。
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { DisplaySummary } from '../../src/api/typesSection5'
import { makeSummary } from '../display/support'
import { controls, DISPLAY_BUTTONS, installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'
import { texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

async function show(summary: DisplaySummary): Promise<VueWrapper> {
  return (await mountDisplay([summary])).page
}

function metrics(page: VueWrapper): [string, string][] {
  return page.findAll('li.metric').map((item) => [item.find('.label').text(), item.find('.value').text()])
}

function resourceRows(root: Element): [string, string][] {
  return Array.from(root.querySelectorAll('li.resource')).map((item) => [
    item.querySelector('.resource-name')?.textContent?.trim() ?? '',
    item.querySelector('.resource-state')?.textContent?.trim() ?? '',
  ])
}

function chips(root: Element): string[] {
  return Array.from(root.querySelectorAll('.tag, .stat')).map((node) => node.textContent?.trim() ?? '')
}

// UI-2a 计划闸门第 3 条：除主题与全屏两个 <button type="button"> 外没有任何可交互元素。
describe('ACC-M2-09 只读：挂载后只有主题与全屏两个按钮', () => {
  it('有数据时', async () => {
    const page = await show(makeSummary())
    expect(page.findAll('li.metric')).toHaveLength(4)
    expect(controls(page)).toEqual(DISPLAY_BUTTONS)
  })

  it('加载中', async () => {
    const { page } = await mountDisplay(['pending'])
    expect(controls(page)).toEqual(DISPLAY_BUTTONS)
  })

  it('没有数据且拉取失败（错误状态）', async () => {
    const { page } = await mountDisplay([new Error('x')])
    expect(page.find('.state.error').exists()).toBe(true)
    expect(controls(page)).toEqual(DISPLAY_BUTTONS)
  })

  it('有旧数据且更新失败', async () => {
    const shown = await mountDisplay([makeSummary(), new Error('x')])
    await shown.nextPoll()
    expect(shown.page.find('.stale').exists()).toBe(true)
    expect(controls(shown.page)).toEqual(DISPLAY_BUTTONS)
  })
})

describe('指标与利用率（D2、D3）', () => {
  it('预约量、当前使用、利用率按百分比显示，并显示数据生成时间', async () => {
    const page = await show(makeSummary({ todayReservationCount: 12, currentInUse: 4, todayUtilizationRate: 0.625 }))

    expect(page.find('h1').text()).toBe('运营大屏')
    expect(metrics(page)).toEqual([['今日预约量', '12'], ['当前使用', '4'], ['今日利用率', '62.5%'], ['开放场地', '2/3']])
    expect(page.find('.updated').text()).toBe('数据更新于 2026-10-12 07:00:00')
  })

  it('利用率为 null：显示“—”，不显示 NaN 或 0', async () => {
    const page = await show(makeSummary({ todayUtilizationRate: null }))

    expect(metrics(page)[2]).toEqual(['今日利用率', '—'])
    expect(page.text()).not.toContain('NaN')
  })

  it('利用率为 0：显示 0.0%（与“—”区分）', async () => {
    expect(metrics(await show(makeSummary({ todayUtilizationRate: 0 })))[2]).toEqual(['今日利用率', '0.0%'])
  })
})

describe('场地状态与场馆分组（D4）', () => {
  const FIVE_STATES = makeSummary({
    venues: [{ venueId: 1, venueName: '网球馆', operationalStatus: 'OPEN', userBookingEnabled: true,
      resourceTotal: 5, resourceOpen: 3, resourcesReservedNow: 2 }],
    resources: [
      { venueId: 1, resourceId: 1, resourceName: '场地甲', state: 'FREE' },
      { venueId: 1, resourceId: 2, resourceName: '场地乙', state: 'RESERVED' },
      { venueId: 1, resourceId: 3, resourceName: '场地丙', state: 'IN_USE' },
      { venueId: 1, resourceId: 4, resourceName: '场地丁', state: 'MAINTENANCE' },
      { venueId: 1, resourceId: 5, resourceName: '场地戊', state: 'DISABLED' },
    ],
  })

  it('五种状态各自渲染中文标签', async () => {
    expect(resourceRows((await show(FIVE_STATES)).element)).toEqual([
      ['场地甲', '空闲'], ['场地乙', '已预约'], ['场地丙', '使用中'], ['场地丁', '维护'], ['场地戊', '停用'],
    ])
  })

  it('每个场馆一组：馆名、运营状态、是否开放预约、开放场地数、当前已预约数，场地只出现在自己的馆下', async () => {
    const page = await show(makeSummary())
    const groups = page.findAll('section.venue')

    expect(groups.map((group) => group.find('.name').text())).toEqual(['网球馆', '羽毛球馆'])
    expect(groups.map((group) => chips(group.element))).toEqual([
      ['开放', '开放预约', '开放场地 2/2', '当前已预约 1'],
      ['关闭', '未开放预约', '开放场地 0/1', '当前已预约 0'],
    ])
    expect(groups.map((group) => resourceRows(group.element))).toEqual([
      [['网球场1', '已预约'], ['网球场2', '空闲']],
      [['羽毛球场1', '维护']],
    ])
  })

  it('venueId 不在 venues[] 中的场地不显示', async () => {
    const summary = makeSummary()
    summary.resources.push({ venueId: 99, resourceId: 50, resourceName: '孤儿场地', state: 'FREE' })
    const page = await show(summary)

    expect(page.text()).not.toContain('孤儿场地')
    expect(page.findAll('li.resource')).toHaveLength(3)
  })
})

describe('本周趋势与系统提示（D2、D5）', () => {
  it('趋势：日期取 MM-DD，显示每天的预约量，柱高按相对最大值', async () => {
    const page = await show(makeSummary({
      weekTrend: [
        { date: '2026-10-11', reservationCount: 2 },
        { date: '2026-10-12', reservationCount: 4 },
        { date: '2026-10-13', reservationCount: 0 },
      ],
    }))
    const bars = page.findAll('li.bar')

    expect(bars.map((bar) => [bar.find('.date').text(), bar.find('.count').text()])).toEqual([
      ['10-11', '2'], ['10-12', '4'], ['10-13', '0'],
    ])
    expect(bars.map((bar) => bar.find('.fill').attributes('style'))).toEqual([
      expect.stringContaining('height: 50%'), expect.stringContaining('height: 100%'), expect.stringContaining('height: 0%'),
    ])
  })

  it('系统提示最多显示 5 条；没有提示时显示“暂无系统提示”', async () => {
    const six = Array.from({ length: 6 }, (_unused, index) => ({ id: index + 1, title: `提示${index + 1}` }))
    const full = await show(makeSummary({ notices: six }))
    expect(texts(full, '.notices .item')).toEqual(['提示1', '提示2', '提示3', '提示4', '提示5'])

    const none = await show(makeSummary({ notices: [] }))
    expect(none.find('.notices .item').exists()).toBe(false)
    expect(none.find('.notices .empty').text()).toBe('暂无系统提示')
  })
})
