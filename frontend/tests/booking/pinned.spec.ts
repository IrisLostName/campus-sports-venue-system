// UI-3：场馆卡片的置顶公告（每个场馆最新一条有效的场馆公告，所有场馆都取）与三层步骤（场馆 → 日期 → 时段）的逐层返回。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { Announcement } from '../../src/api/types'
import { deferred } from '../display/support'
import { openBooking, TODAY, TOMORROW } from './harness'

const SEED_TENNIS_NOTICE = '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'

describe('置顶公告', () => {
  it('进入页面时为每个场馆（含未开放预约的）各请求一次 scope=VENUE，取第一条；没有公告的场馆没有条目', async () => {
    const queries: unknown[] = []
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base, listAnnouncements: (query) => { queries.push(query); return base.listAnnouncements(query) },
    }))

    expect(queries).toEqual([{ scope: 'VENUE', venueId: 1 }, { scope: 'VENUE', venueId: 2 }, { scope: 'VENUE', venueId: 3 }])
    expect(Object.keys(board.pinned.value)).toEqual(['1'])
    expect(board.pinned.value[1]?.title).toBe(SEED_TENNIS_NOTICE)
  })

  it('取最新的一条；未开放预约的场馆也有；系统公告不出现在任何卡片上', async () => {
    const ctx = await openBooking()
    const poolAdmin = await ctx.h.clientFor('admin_pool')
    const tennisAdmin = await ctx.h.clientFor('admin_tennis')
    await poolAdmin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 3, title: '游泳馆检修', content: '本周停开' })
    await tennisAdmin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 1, title: '新球网已更换', content: '欢迎体验' })
    const sys = await ctx.h.clientFor('sysadmin')
    await sys.adminCreateAnnouncement({ scope: 'SYSTEM', title: '系统维护通知', content: '今晚维护' })

    await ctx.board.load()

    expect(ctx.board.pinned.value[1]?.title).toBe('新球网已更换')
    expect(ctx.board.pinned.value[3]).toMatchObject({ title: '游泳馆检修', content: '本周停开' })
    expect(ctx.board.pinned.value[2]).toBeUndefined()
    expect(Object.values(ctx.board.pinned.value).map((item) => item.title)).not.toContain('系统维护通知')
  })

  it('某个场馆的公告取不到：只是该卡片没有公告，场馆列表与其他卡片不受影响，也没有错误文案', async () => {
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base,
      listAnnouncements: (query) => (query.venueId === 1 ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : base.listAnnouncements(query)),
    }))

    expect(board.venues.value).toHaveLength(3)
    expect(board.pinned.value[1]).toBeUndefined()
    expect(board.venuesError.value).toBeNull()
  })

  it('较早一轮较晚返回时不覆盖较新一轮', async () => {
    const slow = deferred<Announcement[]>()
    let round = 0
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base,
      listAnnouncements: (query) => (round === 1 && query.venueId === 1 ? slow.promise : base.listAnnouncements(query)),
    }))
    round = 1
    const stale = board.load()
    round = 2
    await board.load()
    slow.resolve([])
    await stale

    expect(board.pinned.value[1]?.title).toBe(SEED_TENNIS_NOTICE)
  })
})

describe('三层步骤与逐层返回', () => {
  it('场馆 → dates（不请求时段）→ 选定日期进入 slots；backToDates 回到 dates 并清掉日期与时段；backToVenues 回到场馆', async () => {
    const slotDates: string[] = []
    const { board } = await openBooking('zhangsan', (base) => ({
      ...base, getVenueSlots: (venueId, date) => { slotDates.push(date); return base.getVenueSlots(venueId, date) },
    }))
    expect(board.step.value).toBe('venues')

    await board.selectVenue(1)
    expect(board.step.value).toBe('dates')
    expect(slotDates).toEqual([])

    await board.selectDate(TOMORROW)
    expect(board.step.value).toBe('slots')
    expect(slotDates).toEqual([TOMORROW])
    expect(board.groups.value.length).toBeGreaterThan(0)

    board.backToDates()
    expect(board.step.value).toBe('dates')
    expect(board.date.value).toBeNull()
    expect(board.slots.value).toBeNull()
    expect(board.slotsPhase.value).toBe('idle')
    expect(board.dates.value).toHaveLength(7)

    await board.selectDate(TODAY)
    board.backToVenues()
    expect(board.step.value).toBe('venues')
    expect(board.venueId.value).toBeNull()
  })

  it('从确认步骤返回仍在时段层；backToDates 同时清掉已选时段与提交错误', async () => {
    const { board } = await openBooking()
    await board.selectVenue(1)
    await board.selectDate(TOMORROW)
    board.selectSlot(4, '11:00')
    expect(board.step.value).toBe('confirm')

    board.backToSlots()
    expect(board.step.value).toBe('slots')

    board.selectSlot(4, '11:00')
    board.backToDates()
    expect(board.selection.value).toBeNull()
    expect(board.submitError.value).toBeNull()
    expect(board.step.value).toBe('dates')
  })
})
