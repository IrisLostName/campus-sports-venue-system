// P2-1c 裁决第 2 节：签到码浮层的数据——可出示的预约（UPCOMING、CHECKIN_OPEN，按列表顺序）、打开时定位、
// 码按预约逐个获取并缓存、获取失败只影响该卡片且可重试、关闭时按后端状态刷新列表。调用经 ApiCaller。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { checkInByScan } from '../api/support/harness'
import { at, loginAs } from '../reservations/harness'

async function boardWith(wrap?: (api: ApiClient) => ApiClient, timestamp = at('07:50')) {
  const ctx = await loginAs('zhangsan', '/reservation')
  await ctx.travelTo(timestamp)
  // 张三再订两场：一场今天之后的同日下午（UPCOMING），一场后天（UPCOMING）。
  await ctx.h.api.createReservation({ resourceId: 3, serviceDate: '2026-10-13', startTime: '14:00' })
  const api = wrap === undefined ? ctx.h.api : wrap(ctx.h.api)
  const board = ctx.reservationBoard(api)
  await board.load()
  return { ctx, board }
}

describe('可出示的预约与定位', () => {
  it('列表中全部 UPCOMING 与 CHECKIN_OPEN，按列表顺序；打开时定位到所点的那张', async () => {
    const { board } = await boardWith()
    expect(board.cards.value.map((card) => [card.id, card.displayStatus])).toEqual([[1, 'CHECKIN_OPEN'], [3, 'UPCOMING']])

    board.sheet.open(3)
    expect(board.sheet.isOpen.value).toBe(true)
    expect(board.sheet.tickets.value.map((ticket) => ticket.id)).toEqual([1, 3])
    expect(board.sheet.startIndex.value).toBe(1)
  })

  it('不可出示的预约（已签到）不打开浮层，也不出现在卡片里', async () => {
    const { ctx, board } = await boardWith()
    await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)
    await board.load()

    board.sheet.open(1)
    expect(board.sheet.isOpen.value).toBe(false)
    board.sheet.open(3)
    expect(board.sheet.tickets.value.map((ticket) => ticket.id)).toEqual([3])
  })

  it('浮层组件第一次打开前不挂载（按需加载分包）', async () => {
    const { board } = await boardWith()
    expect(board.sheet.everOpened.value).toBe(false)
    board.sheet.open(1)
    expect(board.sheet.everOpened.value).toBe(true)
  })
})

describe('签到码获取与缓存', () => {
  it('打开时为每张卡片取码（GET /reservations/{id}/check-in-code），成功后缓存，再次打开不重复请求', async () => {
    const calls: number[] = []
    const { board } = await boardWith((api) => ({ ...api, getCheckInCode: (id) => { calls.push(id); return api.getCheckInCode(id) } }))

    board.sheet.open(1)
    expect(board.sheet.entryOf(1)).toEqual({ state: 'loading' })
    await flushPromises()
    expect(board.sheet.entryOf(1)).toMatchObject({ state: 'ready', code: expect.stringMatching(/^[0-9a-f-]{36}\.1$/) })
    expect(board.sheet.entryOf(3)).toMatchObject({ state: 'ready', code: expect.stringMatching(/\.3$/) })

    await board.sheet.close()
    board.sheet.open(3)
    await flushPromises()
    expect(calls.sort()).toEqual([1, 3])
  })

  it('一张卡片取码失败：只有它显示错误，其他卡片正常；重试只重新请求这一张', async () => {
    let failing = true
    const calls: number[] = []
    const { board } = await boardWith((api) => ({
      ...api,
      getCheckInCode: (id) => {
        calls.push(id)
        return id === 3 && failing ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : api.getCheckInCode(id)
      },
    }))

    board.sheet.open(1)
    await flushPromises()
    expect(board.sheet.entryOf(1).state).toBe('ready')
    expect(board.sheet.entryOf(3)).toEqual({ state: 'error', message: '服务器开小差了，请稍后再试' })

    failing = false
    board.sheet.retry(3)
    await flushPromises()
    expect(board.sheet.entryOf(3).state).toBe('ready')
    expect(calls).toEqual([1, 3, 3])
  })

  it('取码失败的卡片在再次打开时自动重新请求', async () => {
    let failing = true
    const { board } = await boardWith((api) => ({
      ...api,
      getCheckInCode: (id) => (failing ? Promise.reject(new ApiError(409, 'ALREADY_CHECKED_IN', 'x')) : api.getCheckInCode(id)),
    }))
    board.sheet.open(1)
    await flushPromises()
    expect(board.sheet.entryOf(1)).toEqual({ state: 'error', message: '已签到' })

    failing = false
    await board.sheet.close()
    board.sheet.open(1)
    await flushPromises()
    expect(board.sheet.entryOf(1).state).toBe('ready')
  })
})

describe('关闭浮层', () => {
  it('关闭时按后端状态刷新列表：管理员扫码后卡片变为使用中、只剩签退', async () => {
    const { ctx, board } = await boardWith()
    board.sheet.open(1)
    await flushPromises()
    await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)

    await board.sheet.close()
    expect(board.sheet.isOpen.value).toBe(false)
    expect(board.cards.value[0]).toMatchObject({ id: 1, statusLabel: '使用中', actions: ['CHECK_OUT'] })
    expect(board.sheet.tickets.value.map((ticket) => ticket.id)).toEqual([3])
  })
})
