// 订场页的浏览部分（FE-4 B1–B6）：场馆列表、未开放场馆、日期选项、时段状态、场馆公告。
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { VenueSlots } from '../../src/api/types'
import { createBookingBoard } from '../../src/composables/bookingBoard'
import { defineReferenceStore } from '../../src/stores/reference'
import { deferred } from '../display/support'
import { loginAs } from '../reservations/harness'
import { enterTennis, openBooking, TODAY, TOMORROW } from './harness'

function cellsOf(board: Awaited<ReturnType<typeof openBooking>>['board'], resourceName: string) {
  const group = board.groups.value.find((item) => item.resourceName === resourceName)
  if (group === undefined) {
    throw new Error(`没有场地 ${resourceName}`)
  }
  return group.cells
}

describe('B1/B3 场馆列表', () => {
  it('进入页面时拉取：网球馆可预约，羽毛球馆、游泳馆不可预约；一开始在场馆步骤', async () => {
    const { board } = await openBooking()

    expect(board.step.value).toBe('venues')
    expect(board.venues.value.map((venue) => [venue.name, venue.bookable])).toEqual([
      ['网球馆', true], ['羽毛球馆', false], ['游泳馆', false],
    ])
  })

  it('每次 load 都重新拉取，不缓存：场馆被关闭后再进入页面，列表随之变化', async () => {
    const { board, h } = await openBooking()
    expect(board.venues.value[0]?.bookable).toBe(true)

    const admin = await h.clientFor('sysadmin')
    await admin.adminUpdateVenue(1, { userBookingEnabled: false })
    await board.load()

    expect(board.venues.value[0]?.bookable).toBe(false)
  })

  it('拉取失败：给出错误文案并保持在场馆步骤；重试成功后恢复', async () => {
    let broken = true
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base,
      listVenues: () => (broken ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : base.listVenues()),
    }))
    expect(board.venuesError.value).toBe('服务器开小差了，请稍后再试')
    expect(board.venuesPhase.value).toBe('failed')

    broken = false
    await board.load()
    expect(board.venuesError.value).toBeNull()
    expect(board.venues.value).toHaveLength(3)
  })
})

describe('B2 未开放预约的场馆不能进入', () => {
  it.each([[2, '羽毛球馆'], [3, '游泳馆']])('%s %s：selectVenue 无效，不请求时段，仍在场馆步骤', async (id) => {
    const calls: string[] = []
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base,
      getVenueSlots: (venueId, date) => { calls.push('getVenueSlots'); return base.getVenueSlots(venueId, date) },
      listAnnouncements: (query) => { calls.push('listAnnouncements'); return base.listAnnouncements(query) },
    }))

    await board.selectVenue(id)

    expect(board.step.value).toBe('venues')
    expect(board.venueId.value).toBeNull()
    expect(calls).toEqual([])
  })

  it('不存在的场馆 id 同样无效', async () => {
    const { board } = await openBooking()
    await board.selectVenue(99)

    expect(board.step.value).toBe('venues')
  })
})

describe('B4 日期选项', () => {
  it('选定场馆后：恰好 advanceDays 个，从今天开始，逐日递增', async () => {
    const { board } = await openBooking()
    await board.selectVenue(1)

    expect(board.dates.value.map((option) => option.value)).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ])
    expect(board.dates.value.map((option) => option.weekdayText)).toEqual(['周一', '周二', '周三', '周四', '周五', '周六', '周日'])
    expect(board.date.value).toBe(TODAY)
  })

  it('数量取自 BookingRules.advanceDays，不写死：规则为 3 天时只有 3 个', async () => {
    const ctx = await loginAs('zhangsan', '/booking')
    const threeDays: ApiClient = {
      ...ctx.h.api,
      getBookingRules: async () => ({ ...(await ctx.h.api.getBookingRules()), advanceDays: 3 }),
    }
    const board = createBookingBoard({
      api: threeDays, call: ctx.call, reference: defineReferenceStore({ api: threeDays })(createPinia()), today: () => TODAY,
    })
    await board.load()
    await board.selectVenue(1)

    expect(board.dates.value.map((option) => option.value)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
  })

  it('跨月：今天是月底时日期继续往后数', async () => {
    const ctx = await loginAs('zhangsan', '/booking')
    const board = createBookingBoard({ api: ctx.h.api, call: ctx.call, reference: ctx.reference, today: () => '2026-10-29' })
    await board.load()
    await board.selectVenue(1)

    expect(board.dates.value.map((option) => option.value).slice(0, 5))
      .toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('不在选项里的日期被忽略：不改变所选日期，不请求时段', async () => {
    const calls: string[] = []
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base,
      getVenueSlots: (venueId, date) => { calls.push(date); return base.getVenueSlots(venueId, date) },
    }))
    await board.selectVenue(1)
    await board.selectDate('2026-10-19')
    await board.selectDate('2026-10-11')

    expect(board.date.value).toBe(TODAY)
    expect(calls).toEqual([TODAY])
  })

  it('BookingRules 取不到：没有日期选项并给出错误文案，不会写死 7 天', async () => {
    const ctx = await loginAs('zhangsan', '/booking')
    const noRules: ApiClient = { ...ctx.h.api, getBookingRules: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) }
    const board = createBookingBoard({
      api: noRules, call: ctx.call, reference: defineReferenceStore({ api: noRules })(createPinia()), today: () => TODAY,
    })
    await board.load()
    await board.selectVenue(1)

    expect(board.dates.value).toEqual([])
    expect(board.date.value).toBeNull()
    expect(board.rulesError.value).toBe('服务器开小差了，请稍后再试')
  })
})

describe('B5 时段按场地分组，状态只取接口返回值', () => {
  it('明天：张三的预约是 MINE，李四的是 BOOKED，维护中的场地是 CLOSED，其余 AVAILABLE；只有 AVAILABLE 可选', async () => {
    const ctx = await openBooking()
    const admin = await ctx.h.clientFor('sysadmin')
    await admin.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await enterTennis(ctx.board)

    expect(ctx.board.groups.value.map((group) => group.resourceName)).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
    const first = cellsOf(ctx.board, '网球场1')[0]
    const second = cellsOf(ctx.board, '网球场2')[1]
    const closed = cellsOf(ctx.board, '网球场3')[0]
    const free = cellsOf(ctx.board, '网球场4')[0]
    expect(first).toMatchObject({ startTime: '08:00', status: 'MINE', label: '我的预约', selectable: false })
    expect(second).toMatchObject({ startTime: '09:30', status: 'BOOKED', label: '已被预约', selectable: false })
    expect(closed).toMatchObject({ status: 'CLOSED', label: '不开放', selectable: false })
    expect(free).toMatchObject({ status: 'AVAILABLE', label: '可预约', selectable: true })
  })

  it('今天 09:00：已开始的时段是 PAST、不可选，之后的 AVAILABLE', async () => {
    const { board } = await openBooking()
    await board.selectVenue(1)

    const cells = cellsOf(board, '网球场1')
    expect(cells.slice(0, 2)).toMatchObject([
      { startTime: '08:00', status: 'PAST', label: '已过', selectable: false },
      { startTime: '09:30', status: 'AVAILABLE', label: '可预约', selectable: true },
    ])
  })

  it('选择时段：AVAILABLE 进入确认步骤；MINE、BOOKED、CLOSED、PAST 无效，仍在时段步骤', async () => {
    const ctx = await openBooking()
    const admin = await ctx.h.clientFor('sysadmin')
    await admin.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await ctx.board.selectVenue(1)
    ctx.board.selectSlot(1, '08:00')                     // 今天 08:00 → PAST
    expect(ctx.board.step.value).toBe('slots')
    await ctx.board.selectDate(TOMORROW)

    ctx.board.selectSlot(1, '08:00')                     // MINE
    ctx.board.selectSlot(2, '09:30')                     // BOOKED
    ctx.board.selectSlot(3, '08:00')                     // CLOSED
    ctx.board.selectSlot(1, '10:15')                     // 不存在的时段
    ctx.board.selectSlot(99, '08:00')                    // 不存在的场地
    expect(ctx.board.step.value).toBe('slots')
    expect(ctx.board.selection.value).toBeNull()

    ctx.board.selectSlot(4, '08:00')
    expect(ctx.board.step.value).toBe('confirm')
    expect(ctx.board.selection.value).toEqual({ resourceId: 4, resourceName: '网球场4', startTime: '08:00', endTime: '09:30' })
    expect(ctx.board.confirmation.value).toEqual({
      venueName: '网球馆', resourceName: '网球场4', dateText: '2026-10-13 周二', timeText: '08:00–09:30',
    })
  })

})

describe('B5 选择的清除与过期响应', () => {
  it('换日期会清掉已选时段；返回时段步骤也会清掉', async () => {
    const { board } = await openBooking()
    await enterTennis(board)
    board.selectSlot(4, '08:00')
    expect(board.step.value).toBe('confirm')

    board.backToSlots()
    expect(board.step.value).toBe('slots')

    board.selectSlot(4, '08:00')
    await board.selectDate('2026-10-14')
    expect(board.selection.value).toBeNull()
    expect(board.step.value).toBe('slots')
  })

  it('较早发出、较晚返回的时段结果不会覆盖较新的日期', async () => {
    const slow = deferred<VenueSlots>()
    const { board, h } = await openBooking('zhangsan', (base) => ({
      ...base,
      getVenueSlots: (venueId, date) => (date === '2026-10-14' ? slow.promise : base.getVenueSlots(venueId, date)),
    }))
    await board.selectVenue(1)
    const stale = board.selectDate('2026-10-14')
    await board.selectDate(TOMORROW)
    slow.resolve(await h.api.getVenueSlots(1, '2026-10-14'))
    await stale

    expect(board.slots.value?.date).toBe(TOMORROW)
  })
})

describe('B6 场馆公告', () => {
  it('按所选场馆请求 scope=VENUE，只显示该场馆的公告（不含系统公告与其他场馆的）', async () => {
    const queries: unknown[] = []
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, listAnnouncements: (query) => { queries.push(query); return base.listAnnouncements(query) },
    }))
    const poolAdmin = await ctx.h.clientFor('admin_pool')
    await poolAdmin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 3, title: '游泳馆检修', content: '本周停开' })

    await ctx.board.selectVenue(1)

    expect(queries).toEqual([{ scope: 'VENUE', venueId: 1 }])
    expect(ctx.board.announcementItems.value.map((item) => item.title))
      .toEqual(['场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
  })

  it('重选场馆后公告清空；公告加载失败时给出错误文案', async () => {
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base, listAnnouncements: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')),
    }))
    await board.selectVenue(1)
    expect(board.announcementError.value).toBe('服务器开小差了，请稍后再试')
    expect(board.announcementItems.value).toEqual([])

    board.backToVenues()
    expect(board.announcementError.value).toBeNull()
    expect(board.step.value).toBe('venues')
  })
})
