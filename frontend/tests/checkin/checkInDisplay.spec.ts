// P2-1c：签到码卡片上的时间文字（由 BookingRules 计算，只是展示）与管理端扫码结果的文案（契约 v1.1 错误码一一对应）。
import { describe, expect, it } from 'vitest'

import type { BookingRules, Reservation } from '../../src/api/types'
import type { AdminReservation } from '../../src/api/typesSection5'
import { ERROR_MESSAGES } from '../../src/utils/errorMessages'
import { buildTicket, scanFailure, scanSuccess, shiftTime, slideIndex } from '../../src/utils/checkInDisplay'

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}

const RESERVATION: Reservation = {
  id: 41, venueId: 1, venueName: '网球馆', resourceId: 2, resourceName: '网球场2', userId: 1, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
  purpose: null, createdAt: '2026-10-12T07:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
  adminNote: null, checkInAt: null, checkOutAt: null,
}

describe('签到码卡片', () => {
  it('场馆 · 场地、预约人姓名与用户名、日期、预约时段、可使用时段（含签退截止）、签到时间窗口、签到截止', () => {
    expect(buildTicket(RESERVATION, RULES, { displayName: '张三', username: 'zhangsan' })).toEqual({
      id: 41, venueId: 1, venueName: '网球馆', place: '网球馆 · 网球场2', bookerText: '预约人 张三（zhangsan）',
      dateText: '2026-10-13 周二', slotText: '08:00–09:30', usableText: '08:00–09:30（10:00 前签退）',
      windowText: '07:45–08:15', deadlineText: '08:15', statusLabel: '待使用', displayStatus: 'UPCOMING',
    })
  })

  it('分钟数全部来自 BookingRules：换一组规则文字跟着变', () => {
    const ticket = buildTicket(RESERVATION, { ...RULES, checkInOpenBeforeMinutes: 10, checkInCloseAfterMinutes: 20, checkOutGraceMinutes: 45 }, null)
    expect([ticket.windowText, ticket.deadlineText, ticket.usableText]).toEqual(['07:50–08:20', '08:20', '08:00–09:30（10:15 前签退）'])
  })

  it('规则尚未取得：不显示由规则算出的三项；没有登录人资料时只显示预约里的姓名', () => {
    const ticket = buildTicket(RESERVATION, null, null)
    expect([ticket.usableText, ticket.windowText, ticket.deadlineText]).toEqual([null, null, null])
    expect(ticket.bookerText).toBe('预约人 张三')
  })

  it('状态名取后端的 displayStatus（不推导状态）', () => {
    expect(buildTicket({ ...RESERVATION, displayStatus: 'CHECKIN_OPEN' }, RULES, null).statusLabel).toBe('可签到')
  })

  it('shiftTime：跨过午夜时注明', () => {
    expect(shiftTime('08:00', -15)).toBe('07:45')
    expect(shiftTime('23:30', 45)).toBe('次日 00:15')
    expect(shiftTime('00:10', -15)).toBe('前一日 23:55')
  })

  it('slideIndex：按滚动位置取最近的一张，限制在范围内', () => {
    expect(slideIndex(0, 393, 3)).toBe(0)
    expect(slideIndex(190, 393, 3)).toBe(0)
    expect(slideIndex(200, 393, 3)).toBe(1)
    expect(slideIndex(2000, 393, 3)).toBe(2)
    expect(slideIndex(-50, 393, 3)).toBe(0)
    expect(slideIndex(100, 0, 3)).toBe(0)
  })
})

describe('扫码结果', () => {
  const ADMIN: AdminReservation = { ...RESERVATION, displayStatus: 'IN_USE', checkInAt: '2026-10-13T07:52:31', userUsername: 'zhangsan', userPhone: null }

  it('成功：预约人（姓名与用户名）、场地、日期与时段、签到时刻', () => {
    expect(scanSuccess(ADMIN)).toEqual({
      ok: true, title: '签到成功', detail: null,
      facts: [
        { label: '预约人', value: '张三（zhangsan）' },
        { label: '场地', value: '网球馆 · 网球场2' },
        { label: '时段', value: '2026-10-13 周二 08:00–09:30' },
        { label: '签到时间', value: '07:52' },
      ],
    })
  })

  it('CHECKIN_WINDOW_CLOSED：错误码文案 + 开放时间', () => {
    expect(scanFailure('CHECKIN_WINDOW_CLOSED', { opensAt: '2026-10-13T07:45:00', closesAt: '2026-10-13T08:15:00' })).toMatchObject({
      ok: false, title: ERROR_MESSAGES.CHECKIN_WINDOW_CLOSED, detail: '该预约的签到时间为 2026-10-13 07:45–08:15。',
    })
  })

  it('FORBIDDEN_SCOPE：说明不在授权范围', () => {
    expect(scanFailure('FORBIDDEN_SCOPE', { venueId: 2 })).toMatchObject({ title: '无权操作该场馆', detail: '该预约所属场馆不在你的授权范围内。' })
  })

  it('CHECKIN_CODE_INVALID、ALREADY_CHECKED_IN、INVALID_STATE（含状态名）、VALIDATION_ERROR（签到码格式）', () => {
    expect(scanFailure('CHECKIN_CODE_INVALID', undefined).title).toBe('签到码无效')
    expect(scanFailure('ALREADY_CHECKED_IN', undefined).title).toBe('已签到')
    expect(scanFailure('INVALID_STATE', { status: 'NO_SHOW' })).toMatchObject({ title: '当前状态不允许该操作', detail: '该预约当前为“未到场”。' })
    expect(scanFailure('INVALID_STATE', { status: 'X' }).detail).toBeNull()
    expect(scanFailure('VALIDATION_ERROR', { fields: { code: '签到码格式不正确' } }).title).toBe('签到码格式不正确')
  })

  it('其余错误码按 ERROR_MESSAGES 显示；未知码显示通用文案', () => {
    expect(scanFailure('FORBIDDEN', undefined)).toEqual({ ok: false, title: ERROR_MESSAGES.FORBIDDEN, detail: null, facts: [] })
    expect(scanFailure('SOMETHING_NEW', undefined).title).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })
})
