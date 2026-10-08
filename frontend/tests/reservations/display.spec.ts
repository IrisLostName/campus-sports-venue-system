// 预约展示口径（FE-3 规划裁决 P3、P4、P5、B1 与第 2 节按钮表）：纯函数，不涉及 API 与时间。
import { describe, expect, it } from 'vitest'

import type { Announcement, BookingRules, DisplayStatus, Reservation } from '../../src/api/types'
import {
  actionsFor, buildAnnouncement, buildCard, buildSummary, cancelNote, checkInNote, displayStatusLabel,
  formatServiceDate, formatTimestamp, placeOf, type ReservationAction,
} from '../../src/utils/reservationDisplay'

const RESERVATION: Reservation = {
  id: 7, venueId: 1, venueName: '网球馆', resourceId: 2, resourceName: '网球场2',
  userId: 1, userDisplayName: '张三', serviceDate: '2026-10-13', startTime: '09:30', endTime: '11:00',
  status: 'CONFIRMED', displayStatus: 'UPCOMING', purpose: null, createdAt: '2026-10-12T09:00:00',
  cancelledAt: null, cancelReason: null, cancelledBy: null, adminNote: null, checkInAt: null, checkOutAt: null,
}

const CHECKED_IN = '2026-10-13T09:35:00'
const CHECKED_OUT = '2026-10-13T10:50:00'

describe('P5 displayStatus 中文名', () => {
  it.each<[DisplayStatus, string]>([
    ['UPCOMING', '待使用'],
    ['CHECKIN_OPEN', '可签到'],
    ['IN_USE', '使用中'],
    ['CHECKED_OUT', '已签退'],
    ['COMPLETED', '已完成'],
    ['NO_SHOW', '未到场'],
    ['CANCELLED', '已取消'],
    ['ADMIN_CANCELLED', '管理员已取消'],
  ])('%s → %s', (status, label) => {
    expect(displayStatusLabel(status)).toBe(label)
  })
})

describe('ACC-M2-06 按钮显示规则表（每一行）', () => {
  it.each<[string, DisplayStatus, string | null, string | null, ReservationAction[]]>([
    ['UPCOMING → 取消', 'UPCOMING', null, null, ['CANCEL']],
    ['CHECKIN_OPEN → 签到', 'CHECKIN_OPEN', null, null, ['CHECK_IN']],
    ['IN_USE → 签退', 'IN_USE', CHECKED_IN, null, ['CHECK_OUT']],
    ['COMPLETED 已签到未签退 → 签退', 'COMPLETED', CHECKED_IN, null, ['CHECK_OUT']],
    ['COMPLETED 已签到已签退 → 无', 'COMPLETED', CHECKED_IN, CHECKED_OUT, []],
    ['COMPLETED 无签到记录 → 无', 'COMPLETED', null, null, []],
    ['CHECKED_OUT → 无', 'CHECKED_OUT', CHECKED_IN, CHECKED_OUT, []],
    ['NO_SHOW → 无', 'NO_SHOW', null, null, []],
    ['CANCELLED → 无', 'CANCELLED', null, null, []],
    ['ADMIN_CANCELLED → 无', 'ADMIN_CANCELLED', null, null, []],
  ])('%s', (_name, displayStatus, checkInAt, checkOutAt, expected) => {
    expect(actionsFor({ displayStatus, checkInAt, checkOutAt })).toEqual(expected)
  })

  it('B1：CHECKIN_OPEN 不显示“取消”', () => {
    expect(actionsFor({ displayStatus: 'CHECKIN_OPEN', checkInAt: null, checkOutAt: null })).not.toContain('CANCEL')
  })
})

describe('P4 说明文案的参数来自 BookingRules', () => {
  const RULES: BookingRules = {
    slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 90, checkInOpenBeforeMinutes: 10,
    checkInCloseAfterMinutes: 20, checkOutGraceMinutes: 45, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
  }

  it('取消说明与签到说明使用规则里的数字，换一组规则文案跟着变', () => {
    expect(cancelNote(RULES)).toBe('开始前至少 90 分钟可取消')
    expect(checkInNote(RULES)).toBe('开始前 10 分钟至开始后 20 分钟可签到；结束后 45 分钟内可签退')
    expect(cancelNote({ ...RULES, cancelDeadlineMinutes: 30 })).toBe('开始前至少 30 分钟可取消')
  })

  it('规则尚未取得时，卡片不显示说明，也不写死数字', () => {
    const card = buildCard(RESERVATION, null)

    expect(card.cancelNote).toBeNull()
    expect(card.checkInNote).toBeNull()
  })
})

describe('P3 详情卡片字段', () => {
  const RULES: BookingRules = {
    slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
    checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
  }

  it('场馆、场地、日期与时间、预约人、状态、说明', () => {
    expect(buildCard(RESERVATION, RULES)).toEqual({
      id: 7, place: '网球馆 · 网球场2', dateText: '2026-10-13 周二', timeText: '09:30–11:00',
      userDisplayName: '张三', statusLabel: '待使用', displayStatus: 'UPCOMING',
      purpose: null, adminNote: null,
      checkInNote: '开始前 15 分钟至开始后 15 分钟可签到；结束后 30 分钟内可签退',
      cancelNote: '开始前至少 120 分钟可取消',
      actions: ['CANCEL'],
    })
  })

  it('purpose 与 adminNote 仅在非空时给出（空串、纯空白视为空）', () => {
    const empty = buildCard({ ...RESERVATION, purpose: '', adminNote: '   ' }, RULES)
    const filled = buildCard({ ...RESERVATION, purpose: '网球训练', adminNote: '场地维修，已改派' }, RULES)

    expect([empty.purpose, empty.adminNote]).toEqual([null, null])
    expect([filled.purpose, filled.adminNote]).toEqual(['网球训练', '场地维修，已改派'])
  })

  it('首页摘要：日期、时间、地点、人物、状态中文名', () => {
    expect(buildSummary({ ...RESERVATION, displayStatus: 'CHECKIN_OPEN' })).toEqual({
      id: 7, dateText: '2026-10-13 周二', timeText: '09:30–11:00', place: '网球馆 · 网球场2',
      userDisplayName: '张三', statusLabel: '可签到', displayStatus: 'CHECKIN_OPEN',
    })
  })
})

describe('FE-3 N3 placeOf', () => {
  it('场馆 · 场地；卡片与首页摘要用的是同一个写法', () => {
    expect(placeOf(RESERVATION)).toBe('网球馆 · 网球场2')
    expect(buildCard(RESERVATION, null).place).toBe(placeOf(RESERVATION))
    expect(buildSummary(RESERVATION).place).toBe(placeOf(RESERVATION))
  })
})

describe('格式化', () => {
  it('日期带星期，时间戳去掉秒', () => {
    expect(formatServiceDate('2026-10-12')).toBe('2026-10-12 周一')
    expect(formatServiceDate('2026-10-18')).toBe('2026-10-18 周日')
    expect(formatTimestamp('2026-10-12T09:00:00')).toBe('2026-10-12 09:00')
  })

  it('公告：正文与标题相同则不重复显示，不同则显示', () => {
    const base: Announcement = {
      id: 1, scope: 'SYSTEM', venueId: null, title: '标题', content: '标题', status: 'ACTIVE',
      publishedAt: '2026-10-12T09:00:00', publishedByName: '系统管理员', expiresAt: null,
    }

    expect(buildAnnouncement(base)).toEqual({ id: 1, title: '标题', content: null, publishedText: '2026-10-12 09:00' })
    expect(buildAnnouncement({ ...base, content: '正文' }).content).toBe('正文')
  })
})
