// 大屏展示数据映射（FE-7-rulings D2–D4；ACC-M2-09）：数据来自 mock 的 getDisplaySummary，前端只做文字与分组。
import { describe, expect, it } from 'vitest'

import { buildDisplayBoardView, formatRate, NO_RATE_TEXT, stateLabel } from '../../src/utils/displayModel'
import { createHarness, setTime, TODAY, TOMORROW, type Harness } from '../api/support/harness'
import { makeSummary } from './support'

async function publicSummary(h: Harness) {
  h.logout()
  return buildDisplayBoardView(await h.api.getDisplaySummary())
}

// 明天 08:00：网球场1 已签到（使用中）、网球场2 的 09:30 预约是紧接着的下一时段（已预约）、
// 网球场3 维护、网球场4 停用，羽毛球馆整馆关闭（其场地为维护），泳池场地为空闲。
async function allFiveStates(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('sysadmin')
  await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
  await h.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
  await h.api.adminUpdateVenue(2, { operationalStatus: 'CLOSED' })
  setTime(h, TOMORROW, '08:00')
  await h.loginAs('zhangsan')
  await h.api.checkIn(1)
  return h
}

describe('场地中文状态（D4）：五种状态各一例', () => {
  it('使用中、已预约、维护、停用、空闲都按接口给出的 state 显示中文名', async () => {
    const view = await publicSummary(await allFiveStates())
    const tennis = view.venues.find((venue) => venue.name === '网球馆')
    expect(tennis?.resources.map((r) => `${r.name}:${r.state}:${r.stateLabel}`)).toEqual([
      '网球场1:IN_USE:使用中', '网球场2:RESERVED:已预约', '网球场3:MAINTENANCE:维护', '网球场4:DISABLED:停用',
    ])
    const pool = view.venues.find((venue) => venue.name === '游泳馆')
    expect(pool?.resources.every((r) => r.state === 'FREE' && r.stateLabel === '空闲')).toBe(true)
    expect(pool?.resources).toHaveLength(6)
  })

  it('整馆关闭时场馆显示“关闭”，其场地由接口给出 MAINTENANCE，页面不改写', async () => {
    const view = await publicSummary(await allFiveStates())
    const badminton = view.venues.find((venue) => venue.name === '羽毛球馆')
    expect(badminton?.statusLabel).toBe('关闭')
    expect(badminton?.resources.map((r) => r.stateLabel)).toEqual(Array(6).fill('维护'))
  })

  it('stateLabel 覆盖 ResourceLiveState 的全部五个值', () => {
    expect(stateLabel('FREE')).toBe('空闲')
    expect(stateLabel('RESERVED')).toBe('已预约')
    expect(stateLabel('IN_USE')).toBe('使用中')
    expect(stateLabel('MAINTENANCE')).toBe('维护')
    expect(stateLabel('DISABLED')).toBe('停用')
  })
})

describe('场馆分组（D4）', () => {
  it('每组显示场馆名、运营状态、是否开放预约、开放场地数、当前已预约数，场地按场馆归组', async () => {
    const view = await publicSummary(await allFiveStates())
    const [tennis, badminton, pool] = view.venues
    expect(tennis).toMatchObject({
      name: '网球馆', statusLabel: '开放', bookingLabel: '开放预约',
      openText: '开放场地 2/3', reservedNowText: '当前已预约 2',
    })
    expect(badminton).toMatchObject({ statusLabel: '关闭', bookingLabel: '未开放预约', openText: '开放场地 6/6' })
    expect(pool).toMatchObject({ name: '游泳馆', bookingLabel: '未开放预约', openText: '开放场地 6/6', reservedNowText: '当前已预约 0' })
    expect(view.venues.map((venue) => venue.resources.length)).toEqual([4, 6, 6])
  })

  it('手工数据：只归入与场馆 id 相同的场地，顺序沿用接口', () => {
    const view = buildDisplayBoardView(makeSummary())
    expect(view.venues.map((venue) => venue.resources.map((r) => r.name))).toEqual([
      ['网球场1', '网球场2'], ['羽毛球场1'],
    ])
  })
})

describe('指标与百分比（D2、D3）', () => {
  it('今日预约量、当前使用、利用率与数据生成时间来自接口', async () => {
    const h = createHarness()
    const view = await publicSummary(h)
    expect(view.generatedAtText).toBe(`${TODAY} 07:00:00`)
    expect(view.metrics).toEqual([
      { key: 'reservations', label: '今日预约量', value: '2' },
      { key: 'inUse', label: '当前使用', value: '0' },
      { key: 'utilization', label: '今日利用率', value: '0.0%' },
    ])
  })

  it('比率按百分比显示，保留一位小数', () => {
    expect(formatRate(0)).toBe('0.0%')
    expect(formatRate(0.625)).toBe('62.5%')
    expect(formatRate(2 / 64)).toBe('3.1%')
    expect(formatRate(1)).toBe('100.0%')
  })

  it('利用率为 null 显示“—”（手工数据）', () => {
    const view = buildDisplayBoardView(makeSummary({ todayUtilizationRate: null }))
    expect(formatRate(null)).toBe(NO_RATE_TEXT)
    expect(view.metrics.find((metric) => metric.key === 'utilization')?.value).toBe('—')
  })

  it('开放时段数为 0 时接口给出 null，页面显示“—”（mock）', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    for (const venueId of [1, 2, 3]) {
      await h.api.adminReplaceWeeklyRules(venueId, { windows: [], onExistingReservations: 'KEEP' })
    }
    const view = await publicSummary(h)
    expect(view.metrics.find((metric) => metric.key === 'utilization')?.value).toBe('—')
  })
})
