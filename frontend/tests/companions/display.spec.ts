// P2-2c 同行人的展示口径（裁决第 1、2 节，第 5 节第 2 条）：姓名串、首字、计数，以及各显示位置的视图模型——
// 预约卡片、签到码卡片、管理端列表行与对话框摘要、扫码结果；没有同行人时一律不显示。
import { describe, expect, it } from 'vitest'

import type { BookingRules, Reservation } from '../../src/api/types'
import type { AdminReservation } from '../../src/api/typesSection5'
import { buildReservationRow, reservationSummary } from '../../src/utils/adminReservationDisplay'
import { buildTicket, scanSuccess } from '../../src/utils/checkInDisplay'
import { companionCounter, companionNames, initialOf } from '../../src/utils/companionDisplay'
import { buildCard, buildSummary } from '../../src/utils/reservationDisplay'

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}

const TWO = [{ userId: 4, displayName: '赵六' }, { userId: 2, displayName: '李四' }]

const RESERVATION: Reservation = {
  id: 9, venueId: 1, venueName: '网球馆', resourceId: 2, resourceName: '网球场2', userId: 1, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
  purpose: null, createdAt: '2026-10-12T07:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
  adminNote: null, checkInAt: null, checkOutAt: null, companions: TWO,
}

const ADMIN: AdminReservation = { ...RESERVATION, userUsername: 'zhangsan', userPhone: null }

describe('companionDisplay', () => {
  it('姓名串按名单顺序用顿号连接；空名单为 null', () => {
    expect(companionNames(TWO)).toBe('赵六、李四')
    expect(companionNames([])).toBeNull()
  })

  it('首字按字符取（不拆代理对），去掉首尾空白', () => {
    expect(initialOf('李四')).toBe('李')
    expect(initialOf(' Amy')).toBe('A')
    expect(initialOf('𠀋一')).toBe('𠀋')
    expect(initialOf('')).toBe('?')
  })

  it('计数文案', () => {
    expect(companionCounter(0)).toBe('已添加 0 / 6 位')
    expect(companionCounter(6)).toBe('已添加 6 / 6 位')
  })
})

describe('用户端', () => {
  it('预约卡片：companionsText 为姓名串；没有同行人为 null', () => {
    expect(buildCard(RESERVATION, RULES).companionsText).toBe('赵六、李四')
    expect(buildCard({ ...RESERVATION, companions: [] }, RULES).companionsText).toBeNull()
  })

  it('首页摘要不含同行人', () => {
    expect(buildSummary(RESERVATION)).not.toHaveProperty('companionsText')
  })

  it('签到码卡片表头：“同行：赵六、李四”；没有同行人为 null', () => {
    expect(buildTicket(RESERVATION, RULES, null).companionsText).toBe('同行：赵六、李四')
    expect(buildTicket({ ...RESERVATION, companions: [] }, RULES, null).companionsText).toBeNull()
  })
})

describe('管理端', () => {
  it('列表行：companionsText 为“同行：…”；没有同行人为 null', () => {
    expect(buildReservationRow(ADMIN).companionsText).toBe('同行：赵六、李四')
    expect(buildReservationRow({ ...ADMIN, companions: [] }).companionsText).toBeNull()
  })

  it('取消与改派对话框的预约摘要：有同行人时追加“同行：…”', () => {
    expect(reservationSummary(ADMIN)).toBe('网球馆 · 网球场2 · 2026-10-13 08:00–09:30 · 张三 · 同行：赵六、李四')
    expect(reservationSummary({ ...ADMIN, companions: [] })).toBe('网球馆 · 网球场2 · 2026-10-13 08:00–09:30 · 张三')
  })

  it('扫码结果：“同行”放在最后（扫码记录摘要仍取前三项）；没有同行人时不出现', () => {
    const checked = { ...ADMIN, displayStatus: 'IN_USE' as const, checkInAt: '2026-10-13T07:52:31' }
    const facts = scanSuccess(checked).facts
    expect(facts.map((fact) => fact.label)).toEqual(['预约人', '场地', '时段', '签到时间', '同行'])
    expect(facts.at(-1)).toEqual({ label: '同行', value: '赵六、李四' })
    expect(scanSuccess({ ...checked, companions: [] }).facts.map((fact) => fact.label)).toEqual(['预约人', '场地', '时段', '签到时间'])
  })
})
