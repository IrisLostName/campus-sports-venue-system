// TEST-2 K3：取消按钮按截止时间置灰的判断（docs/03 第 4.4 节“取消按钮的可用性”；TEST-2 裁决第 6 节待定项 1）。
// 边界与后端 ReservationCancelService 一致：距开始正好 cancelDeadlineMinutes 仍可取消，不足时置灰。
import { describe, expect, it } from 'vitest'

import type { BookingRules, DisplayStatus } from '../../src/api/types'
import { cancelLockedNote, isCancelLocked, secondsUntilStart } from '../../src/utils/cancelDeadline'

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}

// 开始 2026-10-13 14:00；截止 12:00。
const UPCOMING = { displayStatus: 'UPCOMING' as DisplayStatus, serviceDate: '2026-10-13', startTime: '14:00' }

describe('secondsUntilStart：按场馆本地墙上时间相减', () => {
  it('同一天与跨天', () => {
    expect(secondsUntilStart(UPCOMING, '2026-10-13T12:00:00')).toBe(120 * 60)
    expect(secondsUntilStart(UPCOMING, '2026-10-12T14:00:00')).toBe(24 * 60 * 60)
    expect(secondsUntilStart(UPCOMING, '2026-10-13T14:00:01')).toBe(-1)
  })
})

describe('TEST-2 K3 isCancelLocked：开始前 121 / 120 / 119 分钟', () => {
  it.each([
    ['开始前 121 分钟（截止前一分钟）：可用', '2026-10-13T11:59:00', false],
    ['开始前正好 120 分钟：可用（与后端“正好等于允许”一致）', '2026-10-13T12:00:00', false],
    ['截止后 1 秒：置灰', '2026-10-13T12:00:01', true],
    ['开始前 119 分钟：置灰', '2026-10-13T12:01:00', true],
    ['开始前 16 分钟：置灰', '2026-10-13T13:44:00', true],
  ])('%s', (_label, now, locked) => {
    expect(isCancelLocked(UPCOMING, RULES, now)).toBe(locked)
  })

  it('截止时长取自 BookingRules：换成 60 分钟，开始前 61 分钟可用、59 分钟置灰', () => {
    const rules = { ...RULES, cancelDeadlineMinutes: 60 }

    expect(isCancelLocked(UPCOMING, rules, '2026-10-13T12:59:00')).toBe(false)
    expect(isCancelLocked(UPCOMING, rules, '2026-10-13T13:00:00')).toBe(false)
    expect(isCancelLocked(UPCOMING, rules, '2026-10-13T13:01:00')).toBe(true)
    expect(isCancelLocked(UPCOMING, RULES, '2026-10-13T13:01:00')).toBe(true)
    expect(isCancelLocked(UPCOMING, rules, '2026-10-13T12:01:00')).toBe(false)
  })

  it('跨零点：00:30 开始，截止是前一天 22:30', () => {
    const early = { ...UPCOMING, serviceDate: '2026-10-14', startTime: '00:30' }

    expect(isCancelLocked(early, RULES, '2026-10-13T22:29:00')).toBe(false)
    expect(isCancelLocked(early, RULES, '2026-10-13T22:30:00')).toBe(false)
    expect(isCancelLocked(early, RULES, '2026-10-13T22:31:00')).toBe(true)
  })

  it('客户端时间已进入签到窗口或已过开始（与服务端给出的 UPCOMING 矛盾）：不置灰，交给后端', () => {
    expect(isCancelLocked(UPCOMING, RULES, '2026-10-13T13:45:00')).toBe(false)
    expect(isCancelLocked(UPCOMING, RULES, '2026-10-13T14:00:00')).toBe(false)
    expect(isCancelLocked(UPCOMING, RULES, '2026-10-20T08:00:00')).toBe(false)
  })

  it('规则尚未取得：不置灰', () => {
    expect(isCancelLocked(UPCOMING, null, '2026-10-13T12:30:00')).toBe(false)
  })

  it.each<DisplayStatus>(['CHECKIN_OPEN', 'IN_USE', 'CHECKED_OUT', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'ADMIN_CANCELLED'])(
    '%s：从不置灰（只有 UPCOMING 有“取消预约”）', (status) => {
      expect(isCancelLocked({ ...UPCOMING, displayStatus: status }, RULES, '2026-10-13T12:30:00')).toBe(false)
    })

  it('说明文字中的分钟数来自规则', () => {
    expect(cancelLockedNote(RULES)).toBe('已过可取消时间（需在开始前至少 120 分钟取消）')
    expect(cancelLockedNote({ ...RULES, cancelDeadlineMinutes: 60 })).toBe('已过可取消时间（需在开始前至少 60 分钟取消）')
  })
})
