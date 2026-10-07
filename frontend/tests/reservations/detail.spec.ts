// “预约”页详情卡片（ACC-M2-05）与按钮显示（ACC-M2-06，对 mock 推进注入时钟得到每一种 displayStatus）。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import type { Reservation } from '../../src/api/types'
import { actionsFor, buildCard } from '../../src/utils/reservationDisplay'
import { at, loginAs, TOMORROW } from './harness'

const FIRST_NOTE = '开始前 15 分钟至开始后 15 分钟可签到；结束后 30 分钟内可签退'
const CANCEL_NOTE = '开始前至少 120 分钟可取消'

describe('ACC-M2-05 详情卡片', () => {
  it('zhangsan 的预约：P3 全部字段，说明文案参数来自 BookingRules', async () => {
    const { reservationBoard, reference, h } = await loginAs('zhangsan', '/reservation')
    const board = reservationBoard()
    await board.load()

    const rules = await h.api.getBookingRules()
    expect(reference.bookingRules).toEqual(rules)
    expect(board.cards.value).toEqual([{
      id: 1, place: '网球馆 · 网球场1', dateText: '2026-10-13 周二', timeText: '08:00–09:30',
      userDisplayName: '张三', statusLabel: '待使用', displayStatus: 'UPCOMING',
      purpose: null, adminNote: null,
      checkInNote: FIRST_NOTE, cancelNote: CANCEL_NOTE, actions: ['CANCEL'],
    }])
    expect(rules).toMatchObject({ cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15 })
  })

  it('每条 CURRENT 预约一张卡片，按开始时间升序；purpose 非空时给出', async () => {
    const { reservationBoard, h } = await loginAs('zhangsan', '/reservation')
    await h.api.createReservation({ resourceId: 2, serviceDate: TOMORROW, startTime: '11:00', purpose: '网球训练' })
    await h.api.createReservation({ resourceId: 3, serviceDate: '2026-10-12', startTime: '09:30' })
    const board = reservationBoard()
    await board.load()

    expect(board.cards.value.map((card) => [card.dateText, card.timeText, card.purpose])).toEqual([
      ['2026-10-12 周一', '09:30–11:00', null],
      ['2026-10-13 周二', '08:00–09:30', null],
      ['2026-10-13 周二', '11:00–12:30', '网球训练'],
    ])
  })

  it('管理员改派后：adminNote 非空时显示，场地为改派后的场地', async () => {
    const { reservationBoard, h } = await loginAs('zhangsan', '/reservation')
    const admin = await h.clientFor('admin_tennis')
    await admin.adminReassignResource(1, { resourceId: 3, serviceDate: TOMORROW, startTime: '08:00', reason: '场地维修，已改派到网球场3' })
    const board = reservationBoard()
    await board.load()

    expect(board.cards.value[0]).toMatchObject({ place: '网球馆 · 网球场3', adminNote: '场地维修，已改派到网球场3', actions: ['CANCEL'] })
  })

  it('管理员取消后：卡片显示“管理员已取消”与 adminNote，没有按钮；不再属于 CURRENT 列表', async () => {
    const { reservationBoard, h } = await loginAs('zhangsan', '/reservation')
    const admin = await h.clientFor('admin_tennis')
    await admin.adminCancelReservation(1, { reason: '场馆临时关闭' })

    const card = buildCard(await h.api.getReservation(1), null)
    const board = reservationBoard()
    await board.load()

    expect(card).toMatchObject({ statusLabel: '管理员已取消', adminNote: '场馆临时关闭', actions: [] })
    expect(board.cards.value).toEqual([])
    expect(board.isEmpty.value).toBe(true)
  })
})

// 在 07:50（签到窗口内）以 zhangsan 的身份做准备操作，再把时钟拨到 timestamp 读取预约。
async function actionsAt(timestamp: string, prepare: (api: ApiClient) => Promise<void>) {
  const ctx = await loginAs('zhangsan', '/reservation')
  await ctx.travelTo(at('07:50'))
  await prepare(ctx.h.api)
  ctx.h.clock.set(timestamp)
  const reservation: Reservation = await ctx.h.api.getReservation(1)
  return { reservation, actions: actionsFor(reservation), card: buildCard(reservation, null) }
}

describe('ACC-M2-06 按钮随 displayStatus 显示（推进注入时钟）', () => {
  it('UPCOMING（开始前一天）→ 取消', async () => {
    const { reservationBoard } = await loginAs('zhangsan', '/reservation')
    const board = reservationBoard()
    await board.load()

    expect(board.cards.value[0]).toMatchObject({ displayStatus: 'UPCOMING', actions: ['CANCEL'] })
  })

  it('CHECKIN_OPEN（07:45，窗口恰好开启）→ 只有签到，没有取消（B1）', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('07:45'))
    const board = ctx.reservationBoard()
    await board.load()

    expect(board.cards.value[0]).toMatchObject({ displayStatus: 'CHECKIN_OPEN', statusLabel: '可签到', actions: ['CHECK_IN'] })
  })

  it('IN_USE（已签到，未到结束）→ 签退', async () => {
    const { actions, reservation } = await actionsAt(at('08:30'), async (api) => { await api.checkIn(1) })

    expect(reservation.displayStatus).toBe('IN_USE')
    expect(actions).toEqual(['CHECK_OUT'])
  })

  it('CHECKED_OUT（已签退，未到结束）→ 无', async () => {
    const { actions, reservation } = await actionsAt(at('08:45'), async (api) => {
      await api.checkIn(1)
      await api.checkOut(1)
    })

    expect(reservation.displayStatus).toBe('CHECKED_OUT')
    expect(actions).toEqual([])
  })

  it('COMPLETED 已签到未签退（09:45，结束后宽限内）→ 签退', async () => {
    const { actions, reservation } = await actionsAt(at('09:45'), async (api) => { await api.checkIn(1) })

    expect(reservation).toMatchObject({ displayStatus: 'COMPLETED', checkOutAt: null })
    expect(reservation.checkInAt).not.toBeNull()
    expect(actions).toEqual(['CHECK_OUT'])
  })

  it('COMPLETED 已签到且已签退 → 无', async () => {
    const { actions, reservation } = await actionsAt(at('09:45'), async (api) => {
      await api.checkIn(1)
      await api.checkOut(1)
    })

    expect(reservation).toMatchObject({ displayStatus: 'COMPLETED' })
    expect(reservation.checkOutAt).not.toBeNull()
    expect(actions).toEqual([])
  })

  it('NO_SHOW（08:16，签到窗口已关闭仍未签到）→ 无', async () => {
    const { actions, card } = await actionsAt(at('08:16'), async () => undefined)

    expect(card.displayStatus).toBe('NO_SHOW')
    expect(card.statusLabel).toBe('未到场')
    expect(actions).toEqual([])
  })

  it('CANCELLED（用户取消后）→ 无', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    const cancelled = await ctx.h.api.cancelReservation(1, {})

    expect(cancelled.displayStatus).toBe('CANCELLED')
    expect(actionsFor(cancelled)).toEqual([])
  })
})
