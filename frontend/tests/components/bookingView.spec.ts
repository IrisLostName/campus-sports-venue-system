// FE-4 “订场”页（ACC-M2-04，挂载整页，数据来自 mock 与注入时钟）：场馆列表、未开放场馆、日期选项、时段渲染、场馆公告。
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BookingView from '../../src/views/user/BookingView.vue'
import { TOMORROW } from '../booking/harness'
import { useApiClient } from './apiSwap'
import {
  dateButton, enterTennis, openPage, pinToday, slotButton, unpinToday, venueButton,
} from './bookingSupport'
import { mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

describe('场馆列表与未开放预约', () => {
  it('显示 3 个场馆：网球馆可进入；羽毛球馆、游泳馆显示“暂未开放预约”且不可点', async () => {
    const { page } = await openPage()

    expect(page.find('h1').text()).toBe('订场')
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(texts(page, '.venue .meta')).toEqual(['4 个场地', '暂未开放预约', '暂未开放预约'])
    expect(page.findAll('.venue').map((node) => node.attributes('disabled') !== undefined)).toEqual([false, true, true])
  })

  it('点羽毛球馆或游泳馆：没有任何变化，不出现日期与时段，也不请求时段', async () => {
    const requested: number[] = []
    const { page } = await openPage({
      wrap: (api) => ({ ...api, getVenueSlots: (venueId, date) => { requested.push(venueId); return api.getVenueSlots(venueId, date) } }),
    })

    await venueButton(page, '羽毛球馆').trigger('click')
    await venueButton(page, '游泳馆').trigger('click')
    await flushPromises()

    expect(requested).toEqual([])
    expect(page.find('[aria-label="选择日期"]').exists()).toBe(false)
    expect(page.findAll('.cell')).toHaveLength(0)
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
  })

  it('场馆被系统管理员关闭预约后，重新进入页面该场馆显示“暂未开放预约”（不缓存）', async () => {
    const first = await openPage()
    const admin = await first.ctx.h.clientFor('sysadmin')
    await admin.adminUpdateVenue(1, { userBookingEnabled: false })
    first.page.unmount()

    useApiClient(first.ctx.h.api)
    const again = mountWithApp(BookingView, first.ctx.h)
    await flushPromises()

    expect(texts(again, '.venue .meta')).toEqual(['暂未开放预约', '暂未开放预约', '暂未开放预约'])
  })
})

describe('日期选项', () => {
  it('恰好 7 个，从今天（2026-10-12）开始，选中项高亮', async () => {
    const { page } = await openPage()
    await venueButton(page, '网球馆').trigger('click')
    await flushPromises()

    const days = page.findAll('.day')
    expect(days.map((node) => node.attributes('data-date'))).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
    expect(days[0]?.text()).toBe('10-12周一')
    expect(days.map((node) => node.classes('active'))).toEqual([true, false, false, false, false, false, false])
  })

  it('个数取自 BookingRules.advanceDays：规则为 3 天时只有 3 个', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, getBookingRules: async () => ({ ...(await api.getBookingRules()), advanceDays: 3 }) }),
    })
    await venueButton(page, '网球馆').trigger('click')
    await flushPromises()

    expect(page.findAll('.day').map((node) => node.attributes('data-date'))).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
  })
})

describe('时段渲染（B5）', () => {
  it('可预约的可点；我的预约、已被预约、不开放、已过都不可点，各带自己的文案', async () => {
    const { page, ctx } = await openPage()
    const admin = await ctx.h.clientFor('sysadmin')
    await admin.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await enterTennis(page, '2026-10-12')

    const pastCell = slotButton(page, '网球场1', '08:00')
    expect(pastCell.attributes('data-status')).toBe('PAST')
    expect(pastCell.find('.label').text()).toBe('已过')
    expect(pastCell.attributes('disabled')).toBeDefined()

    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()
    const mine = slotButton(page, '网球场1', '08:00')
    const booked = slotButton(page, '网球场2', '09:30')
    const closed = slotButton(page, '网球场3', '08:00')
    const free = slotButton(page, '网球场4', '08:00')
    expect([mine, booked, closed, free].map((node) => node.attributes('data-status'))).toEqual(['MINE', 'BOOKED', 'CLOSED', 'AVAILABLE'])
    expect([mine, booked, closed, free].map((node) => node.find('.label').text())).toEqual(['我的预约', '已被预约', '不开放', '可预约'])
    expect([mine, booked, closed, free].map((node) => node.attributes('disabled') !== undefined)).toEqual([true, true, true, false])
  })

  it('按场地分组，每个场地一组，组名是接口返回的场地名', async () => {
    const { page } = await openPage()
    await enterTennis(page)

    expect(texts(page, '.group h3')).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
    expect(page.findAll('section[aria-label="网球场1"] .cell')).toHaveLength(8)
  })

  it('点不可选的时段不会进入确认步骤', async () => {
    const { page } = await openPage()
    await enterTennis(page)

    await slotButton(page, '网球场1', '08:00').trigger('click')
    await slotButton(page, '网球场2', '09:30').trigger('click')

    expect(page.find('[aria-label="确认预约"]').exists()).toBe(false)
  })
})

describe('场馆公告（B6）', () => {
  it('选中网球馆后显示网球馆公告；不显示系统公告，也不显示其他场馆的公告', async () => {
    const { page, ctx } = await openPage()
    const poolAdmin = await ctx.h.clientFor('admin_pool')
    await poolAdmin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 3, title: '游泳馆检修', content: '本周停开' })
    await venueButton(page, '网球馆').trigger('click')
    await flushPromises()

    const notices = page.find('section[aria-label="场馆公告"]')
    expect(notices.exists()).toBe(true)
    expect(texts(page, 'section[aria-label="场馆公告"] h3')).toEqual(['场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
    expect(page.text()).not.toContain('游泳馆检修')
    expect(page.text()).not.toContain('欢迎使用校园场馆预约系统')
  })

  it('场馆列表步骤不显示任何公告', async () => {
    const { page } = await openPage()

    expect(page.find('section[aria-label="场馆公告"]').exists()).toBe(false)
  })
})
