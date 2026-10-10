// FE-8 L7（FE-6 复审）：场馆已关闭而 userBookingEnabled 仍为真时，行上给出“用户端不可预约”的说明。
// 只依据接口字段 userBookingEnabled 与 bookable；开关本身的显示不变。
import { describe, expect, it } from 'vitest'

import { createSysVenues } from '../../src/composables/sysVenues'
import { BOOKING_BLOCKED_HINT } from '../../src/utils/sysVenueDisplay'
import { loginAdmin } from '../admin/harness'

async function openBoard() {
  const ctx = await loginAdmin('sysadmin')
  const board = createSysVenues({ api: ctx.api, call: ctx.call }, async () => undefined)
  await board.load()
  return board
}

const hints = (board: Awaited<ReturnType<typeof openBoard>>) => board.rows.value.map((row) => row.bookingHint)

describe('bookingHint', () => {
  it('说明文字是“场馆已关闭，用户端不可预约”', () => {
    expect(BOOKING_BLOCKED_HINT).toBe('场馆已关闭，用户端不可预约')
  })

  it('种子数据：网球馆开放且开关开着、另外两个开关关着——都没有说明', async () => {
    const board = await openBoard()

    expect(hints(board)).toEqual([null, null, null])
  })

  it('关闭开关仍开着的网球馆：该行出现说明，开关仍显示已开放；重新开放后说明消失', async () => {
    const board = await openBoard()
    await board.status.askClose(1)
    board.status.flow.choose('KEEP')
    await board.status.flow.confirm()

    expect(board.rows.value[0]).toMatchObject({ open: false, bookingEnabled: true, bookingHint: BOOKING_BLOCKED_HINT })
    expect(hints(board)).toEqual([BOOKING_BLOCKED_HINT, null, null])

    await board.status.reopen(1)
    expect(hints(board)).toEqual([null, null, null])
  })

  it('关闭开关本来就关着的游泳馆：没有说明（用户端不可预约的原因不是场馆关闭）', async () => {
    const board = await openBoard()
    await board.status.askClose(3)
    await board.status.flow.confirm()

    expect(board.rows.value[2]).toMatchObject({ open: false, bookingEnabled: false, bookingHint: null })
  })

  it('先打开羽毛球馆的开关再关闭场馆：出现说明；关掉开关后说明消失', async () => {
    const board = await openBoard()
    await board.status.toggleBooking(2, true)
    expect(hints(board)).toEqual([null, null, null])

    await board.status.askClose(2)
    await board.status.flow.confirm()
    expect(board.rows.value[1]).toMatchObject({ open: false, bookingEnabled: true, bookingHint: BOOKING_BLOCKED_HINT })

    await board.status.toggleBooking(2, false)
    expect(board.rows.value[1]).toMatchObject({ open: false, bookingEnabled: false, bookingHint: null })
  })
})
