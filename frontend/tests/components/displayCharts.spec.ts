// UI-2a-rulings 第 1、4 节与计划闸门第 2、6 条：折线图与环形图有可读的文字替代（aria-label 与可见数值），
// 每个点的数值始终显示、不可获得焦点；场地方块、图例与环形图的色调都按 toneForResourceState。
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ResourceLiveState } from '../../src/api/types'
import { toneForResourceState } from '../../src/utils/statusTone'
import { makeSummary } from '../display/support'
import { installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'
import { texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

const WEEK = [5, 2, 0, 3, 4, 1, 6].map((count, index) => ({ date: `2026-10-${String(index + 6).padStart(2, '0')}`, reservationCount: count }))
const STATES: ResourceLiveState[] = ['FREE', 'RESERVED', 'IN_USE', 'MAINTENANCE', 'DISABLED']
const SUMMARY = makeSummary({
  weekTrend: WEEK,
  venues: [{ venueId: 1, venueName: '网球馆', operationalStatus: 'OPEN', userBookingEnabled: true,
    resourceTotal: 6, resourceOpen: 4, resourcesReservedNow: 1 }],
  resources: [...STATES, 'FREE' as const].map((state, index) => ({ venueId: 1, resourceId: index + 1, resourceName: `场地${index + 1}`, state })),
})

async function page(): Promise<VueWrapper> {
  return (await mountDisplay([SUMMARY])).page
}

describe('本周预约趋势', () => {
  it('SVG 是 role="img"，aria-label 写出 7 天的日期与预约量', async () => {
    const svg = (await page()).get('section.trend svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe(
      '本周预约趋势：10-06 5 单，10-07 2 单，10-08 0 单，10-09 3 单，10-10 4 单，10-11 1 单，10-12 6 单')
  })

  it('每个点的数值与日期都是页面上的可见文字；没有可获得焦点的点', async () => {
    const shown = await page()
    expect(texts(shown, 'section.trend .count')).toEqual(['5', '2', '0', '3', '4', '1', '6'])
    expect(texts(shown, 'section.trend .date')).toEqual(['10-06', '10-07', '10-08', '10-09', '10-10', '10-11', '10-12'])
    expect(shown.find('section.trend [tabindex]').exists()).toBe(false)
    expect(texts(shown, 'section.trend .tick')).toEqual(['0', '3', '6'])
  })
})

describe('场地实时状态', () => {
  it('aria-label 写出五种状态的数量与场地总数；图例逐项可见，中心为总数', async () => {
    const shown = await page()
    expect(shown.get('section.donut svg').attributes('aria-label'))
      .toBe('场地实时状态：空闲 2，已预约 1，使用中 1，维护 1，停用 1，共 6 个场地')
    expect(shown.findAll('section.donut .count-item').map((item) => `${item.get('.count-label').text()} ${item.get('.count-value').text()}`))
      .toEqual(['空闲 2', '已预约 1', '使用中 1', '维护 1', '停用 1'])
    expect(shown.get('section.donut .total').text()).toBe('6')
    expect(shown.findAll('section.donut .ring-segment')).toHaveLength(5)
  })

  it('“开放场地”指标为各场馆合计 X/Y', async () => {
    const shown = await page()
    expect(shown.findAll('li.metric').at(3)?.get('.value').text()).toBe('4/6')
  })
})

describe('色调按 toneForResourceState（计划闸门第 6 条）', () => {
  it('场地方块、环形图弧段、环形图图例、场馆下方图例使用同一映射', async () => {
    const shown = await page()
    const tone = (state: ResourceLiveState) => `tone-${toneForResourceState(state)}`
    expect(shown.findAll('li.resource').slice(0, 5).map((item) => item.classes().find((name) => name.startsWith('tone-'))))
      .toEqual(STATES.map(tone))
    expect(shown.findAll('section.donut .count-item').map((item) => item.classes().find((name) => name.startsWith('tone-'))))
      .toEqual(STATES.map(tone))
    expect(shown.findAll('.legend-dot').map((dot) => dot.classes().find((name) => name.startsWith('legend-dot--'))))
      .toEqual(STATES.map((state) => `legend-dot--${toneForResourceState(state)}`))
    expect(texts(shown, '.legend-item')).toEqual(['空闲', '已预约', '使用中', '维护', '停用'])
    expect([tone('IN_USE'), tone('RESERVED'), tone('FREE')]).toEqual(['tone-accent', 'tone-warning', 'tone-success'])
  })
})
