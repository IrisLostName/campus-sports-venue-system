// 订场页的确认与提交（FE-4 B7、B8，ACC-M2-04）：成功结果、失败文案与重新拉取、防重复提交、登录失效。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { CreateReservationRequest } from '../../src/api/requests'
import type { Reservation } from '../../src/api/types'
import { deferred } from '../display/support'
import { enterTennis, openBooking, TOMORROW, FREE_SLOT, type BookingContext } from './harness'

// 选定明天网球场4 的 11:00 时段，进入确认步骤。
async function pickFreeSlot(ctx: BookingContext): Promise<void> {
  await enterTennis(ctx.board)
  ctx.board.selectSlot(4, FREE_SLOT)
  expect(ctx.board.step.value).toBe('confirm')
}

function cellOf(ctx: BookingContext, resourceName: string, startTime: string) {
  return ctx.board.groups.value.find((group) => group.resourceName === resourceName)?.cells.find((cell) => cell.startTime === startTime)
}

describe('ACC-M2-04 订场成功', () => {
  it('张三选网球馆、明天、网球场4、11:00 并确认：显示成功结果；新预约出现在 CURRENT 列表', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    ctx.board.purpose.value = '网球训练'
    await ctx.board.submit()

    expect(ctx.board.step.value).toBe('done')
    expect(ctx.board.result.value).toEqual({
      id: 3, dateText: '2026-10-13 周二', timeText: '11:00–12:30', place: '网球馆 · 网球场4',
      userDisplayName: '张三', statusLabel: '待使用',
    })
    expect(ctx.board.submitError.value).toBeNull()

    const current = ctx.reservationList('CURRENT')
    await current.load()
    expect(current.items.value.map((item) => [item.id, item.resourceName, item.startTime, item.purpose]))
      .toEqual([[1, '网球场1', '08:00', null], [3, '网球场4', '11:00', '网球训练']])
  })

  it('请求只含 resourceId、serviceDate、startTime、purpose：没有 userId、endTime（由服务端决定）', async () => {
    const requests: CreateReservationRequest[] = []
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, createReservation: (request) => { requests.push(request); return base.createReservation(request) },
    }))
    await pickFreeSlot(ctx)
    ctx.board.purpose.value = '  网球训练  '
    await ctx.board.submit()

    expect(requests).toEqual([{ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT, purpose: '网球训练' }])
  })

  it('用途为空或纯空白：请求里不带 purpose，预约的 purpose 为 null', async () => {
    const requests: CreateReservationRequest[] = []
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, createReservation: (request) => { requests.push(request); return base.createReservation(request) },
    }))
    await pickFreeSlot(ctx)
    ctx.board.purpose.value = '   '
    await ctx.board.submit()

    expect(requests).toEqual([{ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT }])
    expect((await ctx.h.api.getReservation(3)).purpose).toBeNull()
  })

  it('选择另一个时段时，上一次填的用途已清空', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    ctx.board.purpose.value = '上一次'
    ctx.board.backToSlots()
    ctx.board.selectSlot(4, '12:30')

    expect(ctx.board.purpose.value).toBe('')
  })

  it('“继续订场”：回到场馆步骤，成功结果清除，可以再订', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    await ctx.board.submit()
    expect(ctx.board.step.value).toBe('done')

    await ctx.board.restart()

    expect(ctx.board.step.value).toBe('venues')
    expect(ctx.board.result.value).toBeNull()
    expect(ctx.board.selection.value).toBeNull()
  })
})

describe('B7 提交进行中不可重复', () => {
  it('连点两次提交：只发出一次 createReservation，进行中 submitting 为真，结束后恢复', async () => {
    const pending = deferred<Reservation>()
    let calls = 0
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, createReservation: () => { calls += 1; return pending.promise },
    }))
    await pickFreeSlot(ctx)

    const first = ctx.board.submit()
    expect(ctx.board.submitting.value).toBe(true)
    const second = ctx.board.submit()
    pending.resolve(await ctx.h.api.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT }))
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(ctx.board.submitting.value).toBe(false)
    expect(ctx.board.step.value).toBe('done')
  })
})

describe('B8 失败：按错误码显示文案并重新拉取当前日期的时段', () => {
  it('SLOT_TAKEN：别人先订走了该时段 → 显示文案；重新拉取后该时段是“已被预约”，退回时段步骤', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    const lisi = await ctx.other('lisi')
    await lisi.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT })

    await ctx.board.submit()

    expect(ctx.board.submitError.value).toBe('该时段刚刚被别人预约了，请重新选择')
    expect(cellOf(ctx, '网球场4', FREE_SLOT)).toMatchObject({ status: 'BOOKED', label: '已被预约', selectable: false })
    expect(ctx.board.step.value).toBe('slots')
    expect(ctx.board.selection.value).toBeNull()
    expect(ctx.board.submitting.value).toBe(false)
  })

  it('BOOKING_LIMIT_REACHED：已持有 3 个 → 显示文案；所选时段仍可预约，留在确认步骤', async () => {
    const ctx = await openBooking()
    await ctx.h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '14:00' })
    await ctx.h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '15:30' })
    await pickFreeSlot(ctx)

    await ctx.board.submit()

    expect(ctx.board.submitError.value).toBe('已达同时持有预约数上限')
    expect(ctx.board.step.value).toBe('confirm')
    expect(cellOf(ctx, '网球场4', FREE_SLOT)).toMatchObject({ status: 'AVAILABLE' })
  })

  it('DATE_OUT_OF_RANGE：服务端已过了几天，所选日期超出范围 → 显示文案，退出确认步骤', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    await ctx.travelTo('2026-10-20T09:00:00')

    await ctx.board.submit()

    expect(ctx.board.submitError.value).toBe('超出可预约日期范围')
    expect(ctx.board.step.value).toBe('slots')
    expect(ctx.board.slotsError.value).toBe('超出可预约日期范围')
  })

  it('VENUE_NOT_BOOKABLE：提交前场馆被系统管理员关闭预约 → 显示文案', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    const admin = await ctx.h.clientFor('sysadmin')
    await admin.adminUpdateVenue(1, { userBookingEnabled: false })

    await ctx.board.submit()

    expect(ctx.board.submitError.value).toBe('该场馆暂未开放预约')
    expect(ctx.board.step.value).toBe('slots')
  })

  it('其他失败（INTERNAL_ERROR）：显示通用文案，时段仍可选时留在确认步骤，可以再试一次', async () => {
    let broken = true
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base,
      createReservation: (request) => (broken ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : base.createReservation(request)),
    }))
    await pickFreeSlot(ctx)

    await ctx.board.submit()
    expect(ctx.board.submitError.value).toBe('服务器开小差了，请稍后再试')
    expect(ctx.board.step.value).toBe('confirm')

    broken = false
    await ctx.board.submit()
    expect(ctx.board.step.value).toBe('done')
    expect(ctx.board.submitError.value).toBeNull()
  })
})

describe('X1 登录失效回到登录页', () => {
  it('提交时 TOKEN_EXPIRED：回到登录页，不显示错误，submitting 恢复', async () => {
    const ctx = await openBooking()
    await pickFreeSlot(ctx)
    ctx.h.clock.set('2026-10-12T18:00:00')       // 令牌 8 小时后过期

    await ctx.board.submit()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(ctx.h.auth.isAuthenticated).toBe(false)
    expect(ctx.board.submitError.value).toBeNull()
    expect(ctx.board.submitting.value).toBe(false)
  })

  it('拉取场馆或时段时 TOKEN_EXPIRED：同样回到登录页，没有错误文案', async () => {
    const ctx = await openBooking()
    ctx.h.clock.set('2026-10-12T18:00:00')

    await ctx.board.selectVenue(1)

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(ctx.board.slotsError.value).toBeNull()
    expect(ctx.board.announcementError.value).toBeNull()
  })
})

describe('越过界面的无效操作', () => {
  it('没有选时段时 submit 什么也不做', async () => {
    const calls: string[] = []
    const ctx = await openBooking('zhangsan', (base: ApiClient) => ({
      ...base, createReservation: (request) => { calls.push('create'); return base.createReservation(request) },
    }))
    await enterTennis(ctx.board)

    await ctx.board.submit()

    expect(calls).toEqual([])
    expect(ctx.board.step.value).toBe('slots')
  })
})
