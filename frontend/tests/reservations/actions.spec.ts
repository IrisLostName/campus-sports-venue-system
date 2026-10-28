// “预约”页的出示签到码（P2-1c）、签退、取消（B2、B3）：成功后卡片用返回值更新；失败按错误码显示文案并重新拉取列表。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import type { Reservation } from '../../src/api/types'
import { deferred } from '../display/support'
import { checkInByScan } from '../api/support/harness'
import { at, loginAs, type UserContext } from './harness'

// 加载“预约”页；timestamp 之后才进入页面（07:45 起可签到）。
async function openAt(timestamp?: string) {
  const ctx = await loginAs('zhangsan', '/reservation')
  if (timestamp !== undefined) {
    await ctx.travelTo(timestamp)
  }
  const board = ctx.reservationBoard()
  await board.load()
  return { ...ctx, board }
}

async function confirmCancel(board: Awaited<ReturnType<typeof openAt>>['board'], reason?: string): Promise<void> {
  await board.trigger('CANCEL', 1)
  if (reason !== undefined) {
    board.cancelReason.value = reason
  }
  await board.confirmCancel()
}

async function reserved(ctx: UserContext) {
  return ctx.h.api.getReservation(1)
}

describe('取消：二次确认、可选原因', () => {
  it('点“取消”只打开确认，不调用接口；“再想想”关闭确认，预约不变', async () => {
    const { board, h } = await openAt()

    await board.trigger('CANCEL', 1)
    expect(board.cancelTarget.value).toMatchObject({ id: 1, place: '网球馆 · 网球场1' })
    expect((await h.api.getReservation(1)).status).toBe('CONFIRMED')

    board.dismissCancel()
    expect(board.cancelTarget.value).toBeNull()
    expect((await h.api.getReservation(1)).status).toBe('CONFIRMED')
  })

  it('确认并填写原因：卡片更新为“已取消”，没有按钮；原因随请求提交', async () => {
    const ctx = await openAt()
    await confirmCancel(ctx.board, '  临时有事  ')

    expect(ctx.board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '已取消', actions: [] })
    expect(ctx.board.cancelTarget.value).toBeNull()
    expect(await reserved(ctx)).toMatchObject({ status: 'CANCELLED', cancelReason: '临时有事' })
  })

  it('不填原因：不提交 reason', async () => {
    const ctx = await openAt()
    await confirmCancel(ctx.board)

    expect((await reserved(ctx)).cancelReason).toBeNull()
  })

  it('CANCEL_DEADLINE_PASSED：显示“已超过可取消时间”，并重新拉取列表（卡片仍在）', async () => {
    const ctx = await openAt()
    await ctx.travelTo(at('06:30'))       // 距开始 90 分钟 < 120，仍未到签到窗口
    await confirmCancel(ctx.board)

    expect(ctx.board.feedbackFor(1)).toBe('已超过可取消时间')
    expect(ctx.board.cards.value[0]).toMatchObject({ id: 1, displayStatus: 'UPCOMING' })
    expect(ctx.board.isBusy.value).toBe(false)
  })

  it('INVALID_STATE：预约已被管理员取消后再取消 → 文案；卡片已不在列表，文案改为页面提示', async () => {
    const ctx = await openAt()
    await (await ctx.h.clientFor('admin_tennis')).adminCancelReservation(1, { reason: '场馆临时关闭' })
    await confirmCancel(ctx.board)

    expect(ctx.board.pageFeedback.value).toBe('当前状态不允许该操作')
    expect(ctx.board.cards.value).toEqual([])
    expect(ctx.board.isEmpty.value).toBe(true)
  })
})

// v1.1（P2-1c）：用户不能自行签到。“出示签到码”只打开签到码浮层，不调用签到或签退接口。
describe('出示签到码', () => {
  it('UPCOMING 与 CHECKIN_OPEN 都提供“出示签到码”；点它打开浮层并定位到该预约，不改变预约', async () => {
    const ctx = await openAt(at('07:50'))
    expect(ctx.board.cards.value[0]).toMatchObject({ id: 1, displayStatus: 'CHECKIN_OPEN', actions: ['SHOW_CODE'] })
    await ctx.board.trigger('SHOW_CODE', 1)

    expect(ctx.board.sheet.isOpen.value).toBe(true)
    expect(ctx.board.sheet.tickets.value.map((ticket) => ticket.id)).toEqual([1])
    expect(ctx.board.isBusy.value).toBe(false)
    expect((await reserved(ctx)).checkInAt).toBeNull()
  })

  it('页面上没有提供的动作不会触发：已签到（使用中）的卡片点“出示签到码”不打开浮层', async () => {
    const ctx = await openAt(at('07:50'))
    await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)
    await ctx.board.load()
    await ctx.board.trigger('SHOW_CODE', 1)

    expect(ctx.board.sheet.isOpen.value).toBe(false)
    expect(ctx.board.feedbackFor(1)).toBeNull()
  })
})

// 签退的前置“已签到”由系统管理员扫码完成（checkInByScan），再重新加载“预约”页。
async function scannedAt(timestamp: string) {
  const ctx = await openAt(timestamp)
  await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)
  await ctx.board.load()
  return ctx
}

describe('签退', () => {
  it('成功（使用中）：卡片更新为“已签退”', async () => {
    const ctx = await scannedAt(at('07:50'))
    ctx.h.clock.set(at('08:45'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.cards.value[0]).toMatchObject({ statusLabel: '已签退', actions: [] })
    expect((await reserved(ctx)).checkOutAt).toBe(at('08:45'))
  })

  it('结束后宽限内（09:45）仍可签退：卡片更新为“已完成”', async () => {
    const ctx = await scannedAt(at('07:50'))
    ctx.h.clock.set(at('09:45'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.cards.value[0]).toMatchObject({ statusLabel: '已完成', actions: [] })
  })

  it('INVALID_STATE：超出签退宽限（10:00）→ “当前状态不允许该操作”', async () => {
    const ctx = await scannedAt(at('07:50'))
    ctx.h.clock.set(at('10:00'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.pageFeedback.value).toBe('当前状态不允许该操作')
    expect((await reserved(ctx)).checkOutAt).toBeNull()
  })
})

describe('B3 操作进行中不可重复点击', () => {
  it('同一张卡片连点签退：只发出一次请求，进行中 isBusy 为真，结束后恢复', async () => {
    const ctx = await scannedAt(at('07:50'))
    ctx.h.clock.set(at('08:30'))
    let calls = 0
    const counting: ApiClient = { ...ctx.h.api, checkOut: (id) => { calls += 1; return ctx.h.api.checkOut(id) } }
    const board = ctx.reservationBoard(counting)
    await board.load()

    const first = board.trigger('CHECK_OUT', 1)
    expect(board.isBusy.value).toBe(true)
    expect(board.busyId.value).toBe(1)
    const second = board.trigger('CHECK_OUT', 1)
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(board.isBusy.value).toBe(false)
  })

  it('FE-3 N2 连点“确认取消”：只发出一次取消请求（守卫只在 perform）', async () => {
    const ctx = await openAt()
    let calls = 0
    const counting: ApiClient = { ...ctx.h.api, cancelReservation: (id, request) => { calls += 1; return ctx.h.api.cancelReservation(id, request) } }
    const board = ctx.reservationBoard(counting)
    await board.load()
    await board.trigger('CANCEL', 1)

    const first = board.confirmCancel()
    const second = board.confirmCancel()
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(board.isBusy.value).toBe(false)
    expect(board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '已取消' })
  })

  it('FE-3 N2 取消进行中再确认另一条的取消：不会发出第二个请求', async () => {
    const ctx = await openAt()
    await ctx.h.api.createReservation({ resourceId: 2, serviceDate: '2026-10-13', startTime: '11:00' })
    const pending = deferred<Reservation>()
    const requested: number[] = []
    const slow: ApiClient = { ...ctx.h.api, cancelReservation: (id) => { requested.push(id); return pending.promise } }
    const board = ctx.reservationBoard(slow)
    await board.load()

    await board.trigger('CANCEL', 1)
    const first = board.confirmCancel()
    await board.trigger('CANCEL', 3)
    await board.confirmCancel()
    expect(requested).toEqual([1])
    expect(board.busyId.value).toBe(1)

    pending.resolve(await ctx.h.api.cancelReservation(1, {}))
    await first
    expect(requested).toEqual([1])
    expect(board.isBusy.value).toBe(false)
  })
})
