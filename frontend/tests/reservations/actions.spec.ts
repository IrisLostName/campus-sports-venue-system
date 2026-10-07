// “预约”页的签到、签退、取消（B2、B3）：成功后卡片用返回值更新；失败按错误码显示文案并重新拉取列表。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
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

describe('签到', () => {
  it('成功：卡片更新为“使用中”，按钮换成签退', async () => {
    const ctx = await openAt(at('07:50'))
    await ctx.board.trigger('CHECK_IN', 1)

    expect(ctx.board.cards.value[0]).toMatchObject({ statusLabel: '使用中', actions: ['CHECK_OUT'] })
    expect((await reserved(ctx)).checkInAt).toBe(at('07:50'))
  })

  it('CHECKIN_WINDOW_CLOSED：页面显示可签到，但服务端认为不在窗口内（时钟有偏差）→ “当前不在签到时间内”，卡片按服务端状态刷新', async () => {
    const ctx = await openAt(at('07:50'))
    ctx.h.clock.set(at('07:40'))
    await ctx.board.trigger('CHECK_IN', 1)

    expect(ctx.board.feedbackFor(1)).toBe('当前不在签到时间内')
    expect(ctx.board.cards.value[0]).toMatchObject({ id: 1, displayStatus: 'UPCOMING', actions: ['CANCEL'] })
  })

  it('INVALID_STATE：窗口关闭后未到场被置为 NO_SHOW，再点签到 → “当前状态不允许该操作”，卡片已不在 CURRENT 列表', async () => {
    const ctx = await openAt(at('07:50'))
    ctx.h.clock.set(at('08:16'))
    await ctx.board.trigger('CHECK_IN', 1)

    expect(ctx.board.pageFeedback.value).toBe('当前状态不允许该操作')
    expect(ctx.board.cards.value).toEqual([])
  })

  it('页面上没有提供的动作不会触发：UPCOMING 的卡片点签到不调用接口', async () => {
    const ctx = await openAt()
    await ctx.board.trigger('CHECK_IN', 1)

    expect((await reserved(ctx)).checkInAt).toBeNull()
    expect(ctx.board.feedbackFor(1)).toBeNull()
  })
})

describe('签退', () => {
  it('成功（使用中）：卡片更新为“已签退”', async () => {
    const ctx = await openAt(at('07:50'))
    await ctx.board.trigger('CHECK_IN', 1)
    ctx.h.clock.set(at('08:45'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.cards.value[0]).toMatchObject({ statusLabel: '已签退', actions: [] })
    expect((await reserved(ctx)).checkOutAt).toBe(at('08:45'))
  })

  it('结束后宽限内（09:45）仍可签退：卡片更新为“已完成”', async () => {
    const ctx = await openAt(at('07:50'))
    await ctx.board.trigger('CHECK_IN', 1)
    ctx.h.clock.set(at('09:45'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.cards.value[0]).toMatchObject({ statusLabel: '已完成', actions: [] })
  })

  it('INVALID_STATE：超出签退宽限（10:00）→ “当前状态不允许该操作”', async () => {
    const ctx = await openAt(at('07:50'))
    await ctx.board.trigger('CHECK_IN', 1)
    ctx.h.clock.set(at('10:00'))
    await ctx.board.trigger('CHECK_OUT', 1)

    expect(ctx.board.pageFeedback.value).toBe('当前状态不允许该操作')
    expect((await reserved(ctx)).checkOutAt).toBeNull()
  })
})

describe('B3 操作进行中不可重复点击', () => {
  it('同一张卡片连点签到：只发出一次请求，进行中 isBusy 为真，结束后恢复', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('07:50'))
    let calls = 0
    const counting: ApiClient = { ...ctx.h.api, checkIn: (id) => { calls += 1; return ctx.h.api.checkIn(id) } }
    const board = ctx.reservationBoard(counting)
    await board.load()

    const first = board.trigger('CHECK_IN', 1)
    expect(board.isBusy.value).toBe(true)
    expect(board.busyId.value).toBe(1)
    const second = board.trigger('CHECK_IN', 1)
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(board.isBusy.value).toBe(false)
  })
})
