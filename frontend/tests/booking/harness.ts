// FE-4 订场测试脚手架：在 FE-3 的用户脚手架（Pinia + 内存路由 + mock ApiClient + 注入时钟）上登录一个用户，
// 并接好订场控制器。“今天”由测试注入（与 mock 服务端时钟同一天），不读真实时间。
import type { ApiClient } from '../../src/api/client'
import { createBookingBoard, type BookingBoard } from '../../src/composables/bookingBoard'
import { loginAs, type UserContext } from '../reservations/harness'

export const TODAY = '2026-10-12'          // mock 时钟的起点，2026-10-12 周一 09:00
export const TOMORROW = '2026-10-13'
export const FREE_SLOT = '11:00'           // 网球场1 明天 11:00 起的时段在种子里是空闲的

export interface BookingContext extends UserContext {
  board: BookingBoard
  // 以另一个账号登录的独立客户端（共享同一份 mock 数据与时钟）。
  other(username: string): Promise<ApiClient>
}

export function boardFor(ctx: UserContext, api: ApiClient = ctx.h.api, today: string = TODAY): BookingBoard {
  return createBookingBoard({ api, call: ctx.call, reference: ctx.reference, today: () => today })
}

export async function openBooking(username = 'zhangsan', api?: (base: ApiClient) => ApiClient): Promise<BookingContext> {
  const ctx = await loginAs(username, '/booking')
  const board = boardFor(ctx, api === undefined ? ctx.h.api : api(ctx.h.api))
  await board.load()
  return { ...ctx, board, other: (name) => ctx.h.clientFor(name) }
}

// 进入网球馆（id 1）并选定日期，返回时段已加载的控制器。UI-3 起选定场馆后不默认选中日期，今天也要显式选定。
export async function enterTennis(board: BookingBoard, date: string = TOMORROW): Promise<void> {
  await board.selectVenue(1)
  await board.selectDate(date)
}
