// “我的”页的历史预约（FE-4 M2）：scope=HISTORY、每页 20 条加载更多、复用 actionsFor 使已完成未签退的预约可签退。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { MyReservationsQuery } from '../../src/api/requests'
import { createMeBoard, type MeBoard } from '../../src/composables/meBoard'
import { at, loginAs, type UserContext } from '../reservations/harness'
import { seedCancelledHistory } from '../reservations/history'

function boardFor(ctx: UserContext, api: ApiClient = ctx.h.api): MeBoard {
  return createMeBoard({ api, call: ctx.call })
}

// 张三的预约（明天 08:00–09:30）：07:50 签到，然后时间走到 timestamp（预约已结束，成为 HISTORY）。
async function checkedInThenOver(ctx: UserContext, timestamp: string): Promise<void> {
  await ctx.travelTo(at('07:50'))
  await ctx.h.api.checkIn(1)
  await ctx.travelTo(timestamp)
}

describe('历史列表', () => {
  it('只请求 scope=HISTORY；没有历史预约是空状态', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const queries: MyReservationsQuery[] = []
    const board = boardFor(ctx, { ...ctx.h.api, listMyReservations: (query) => { queries.push({ ...query }); return ctx.h.api.listMyReservations(query) } })

    await board.load()

    expect(queries).toEqual([{ scope: 'HISTORY', page: 1, pageSize: 20 }])
    expect(board.isEmpty.value).toBe(true)
    expect(board.cards.value).toEqual([])
    expect(board.hasMore.value).toBe(false)
  })

  it('CURRENT 的预约不在历史里；取消后的预约进入历史，卡片是“已取消”且没有按钮', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await ctx.h.api.cancelReservation(1, {})
    const board = boardFor(ctx)
    await board.load()

    expect(board.cards.value).toHaveLength(1)
    expect(board.cards.value[0]).toMatchObject({
      id: 1, place: '网球馆 · 网球场1', dateText: '2026-10-13 周二', timeText: '08:00–09:30',
      statusLabel: '已取消', actions: [], checkInNote: null, cancelNote: null,
    })
  })

  it('每页 20 条，“加载更多”追加剩余，顺序为开始时间倒序', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    const board = boardFor(ctx)

    await board.load()
    expect(board.cards.value).toHaveLength(20)
    expect(board.hasMore.value).toBe(true)

    await board.loadMore()
    expect(board.cards.value).toHaveLength(25)
    expect(board.hasMore.value).toBe(false)
    const dates = board.cards.value.map((card) => `${card.dateText} ${card.timeText}`)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('X1 令牌过期：回到登录页', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    ctx.h.clock.set('2026-10-12T18:00:00')
    const board = boardFor(ctx)

    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.loadError.value).toBeNull()
  })
})

describe('复用 actionsFor：已完成未签退的预约在历史里可签退', () => {
  it('COMPLETED、已签到、未签退 → 只有“签退”；签退后卡片更新、按钮消失', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await checkedInThenOver(ctx, at('09:40'))
    const board = boardFor(ctx)
    await board.load()

    expect(board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '已完成', actions: ['CHECK_OUT'] })

    await board.trigger('CHECK_OUT', 1)

    expect((await ctx.h.api.getReservation(1)).checkOutAt).not.toBeNull()
    expect(board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '已完成', actions: [] })
    expect(board.isBusy.value).toBe(false)
  })

  it('已签到未签退的 COMPLETED 之外：NO_SHOW 与已签退的 COMPLETED 没有任何按钮', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await ctx.travelTo(at('08:30'))                        // 超过签到窗口，成为 NO_SHOW
    const board = boardFor(ctx)
    await board.load()

    expect(board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '未到场', actions: [] })
  })

  it('超过签退宽限：后端返回 INVALID_STATE → 卡片上显示文案，并重新拉取（按钮仍在）', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await checkedInThenOver(ctx, at('09:40'))
    const board = boardFor(ctx)
    await board.load()
    await ctx.travelTo(at('10:05'))                         // 结束后 30 分钟之外

    await board.trigger('CHECK_OUT', 1)

    expect(board.feedbackFor(1)).toBe('当前状态不允许该操作')
    expect(board.cards.value[0]?.actions).toEqual(['CHECK_OUT'])
    expect(board.isBusy.value).toBe(false)
  })

  it('签退失败时重新拉取会保留已经“加载更多”的页', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await checkedInThenOver(ctx, at('09:40'))
    const board = boardFor(ctx, {
      ...ctx.h.api, checkOut: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')),
    })
    await board.load()

    await board.trigger('CHECK_OUT', 1)

    expect(board.feedbackFor(1)).toBe('服务器开小差了，请稍后再试')
    expect(board.cards.value).toHaveLength(1)
  })

  it('X1 签退时令牌过期：回到登录页，不显示卡片错误', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await checkedInThenOver(ctx, at('09:40'))
    const board = boardFor(ctx, {
      ...ctx.h.api, checkOut: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')),
    })
    await board.load()

    await board.trigger('CHECK_OUT', 1)

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.feedbackFor(1)).toBeNull()
    expect(board.isBusy.value).toBe(false)
  })

  it('签退进行中连点：只发出一次请求', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await checkedInThenOver(ctx, at('09:40'))
    let calls = 0
    const board = boardFor(ctx, { ...ctx.h.api, checkOut: (id) => { calls += 1; return ctx.h.api.checkOut(id) } })
    await board.load()

    await Promise.all([board.trigger('CHECK_OUT', 1), board.trigger('CHECK_OUT', 1)])

    expect(calls).toBe(1)
  })
})

describe('FE-8 L2 历史里不提供“取消”', () => {
  // 接口在 HISTORY 里不会给出 UPCOMING 的预约；这里让它给出（返回“当前”列表），证明卡片只依据字段、不会因此出现“取消”。
  async function historyShowing(ctx: UserContext, onCancel: () => void): Promise<MeBoard> {
    const current = await ctx.h.api.listMyReservations({ scope: 'CURRENT' })
    return boardFor(ctx, {
      ...ctx.h.api,
      listMyReservations: () => Promise.resolve(current),
      cancelReservation: (id, request) => { onCancel(); return ctx.h.api.cancelReservation(id, request) },
    })
  }

  it('历史里出现 UPCOMING 的预约：卡片没有任何按钮；trigger(CANCEL) 不打开确认层、不发请求', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    let cancelCalls = 0
    const board = await historyShowing(ctx, () => { cancelCalls += 1 })

    await board.load()
    await board.trigger('CANCEL', 1)

    expect(board.cards.value[0]).toMatchObject({ id: 1, displayStatus: 'UPCOMING', statusLabel: '待使用', actions: [] })
    expect(board.cancelTarget.value).toBeNull()
    expect(cancelCalls).toBe(0)
  })

  it('只排除 CANCEL：同一份数据里可签到的预约仍有“签到”', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await ctx.travelTo(at('07:50'))
    const board = await historyShowing(ctx, () => undefined)

    await board.load()

    expect(board.cards.value[0]).toMatchObject({ id: 1, displayStatus: 'CHECKIN_OPEN', actions: ['CHECK_IN'] })
  })
})
