// N-1：“预约”页、首页的调用遇到登录状态失效时，经 callApi 回到登录页（证明没有绕过 callApi）。
import { describe, expect, it } from 'vitest'

import type { UserContext } from './harness'
import { at, loginAs, MINUTES_OVER_TOKEN_LIFETIME } from './harness'

function expectBackAtLogin(ctx: UserContext, redirect: string): void {
  const { h } = ctx
  expect(h.auth.isAuthenticated).toBe(false)
  expect(h.storage.items.size).toBe(0)
  expect(h.router.currentRoute.value.path).toBe('/login')
  expect(h.router.currentRoute.value.query.redirect).toBe(redirect)
  expect(h.auth.notice).toBe('登录已过期，请重新登录')
}

describe('N-1 TOKEN_EXPIRED → 回到登录页（带返回地址与过期提示）', () => {
  it('预约页加载列表', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    ctx.h.clock.advanceMinutes(MINUTES_OVER_TOKEN_LIFETIME)
    const board = ctx.reservationBoard()
    await board.load()

    expectBackAtLogin(ctx, '/reservation')
    expect(board.loadError.value).toBeNull()
  })

  it('预约页取消', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    const board = ctx.reservationBoard()
    await board.load()
    ctx.h.clock.advanceMinutes(MINUTES_OVER_TOKEN_LIFETIME)
    await board.trigger('CANCEL', 1)
    await board.confirmCancel()

    expectBackAtLogin(ctx, '/reservation')
    expect(board.isBusy.value).toBe(false)
    expect(board.feedbackFor(1)).toBeNull()
  })

  it('预约页签到', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('07:50'))
    const board = ctx.reservationBoard()
    await board.load()
    ctx.h.clock.advanceMinutes(MINUTES_OVER_TOKEN_LIFETIME)
    await board.trigger('CHECK_IN', 1)

    expectBackAtLogin(ctx, '/reservation')
    expect(board.isBusy.value).toBe(false)
  })

  it('预约页签退', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('07:50'))
    const board = ctx.reservationBoard()
    await board.load()
    await board.trigger('CHECK_IN', 1)
    ctx.h.clock.advanceMinutes(MINUTES_OVER_TOKEN_LIFETIME)
    await board.trigger('CHECK_OUT', 1)

    expectBackAtLogin(ctx, '/reservation')
    expect(board.isBusy.value).toBe(false)
  })

  it('首页加载预约与公告', async () => {
    const ctx = await loginAs('zhangsan', '/')
    ctx.h.clock.advanceMinutes(MINUTES_OVER_TOKEN_LIFETIME)
    const home = ctx.homeBoard()
    await home.load()

    expectBackAtLogin(ctx, '/')
    expect(home.sections.value).toEqual([])
  })
})

describe('N-1 ACCOUNT_DISABLED → 回到登录页（不带返回地址）', () => {
  it('预约页加载列表', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.h.disableAccount('zhangsan')
    const board = ctx.reservationBoard()
    await board.load()

    expect(ctx.h.router.currentRoute.value.fullPath).toBe('/login')
    expect(ctx.h.auth.notice).toBe('账号已停用')
    expect(ctx.h.auth.isAuthenticated).toBe(false)
  })
})
