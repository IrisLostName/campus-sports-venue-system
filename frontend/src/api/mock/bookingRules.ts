// mock 的预约参数配置（规划裁决 A13）：默认值取自 docs/03 第 4.3 节（设计假设），与种子数据分离。
import type { BookingRules } from '../types'

export const SLOT_MINUTES = 90
export const TOKEN_TTL_HOURS = 8        // docs/12 第 5.1 节：Token 8 小时过期

export const MOCK_BOOKING_RULES: BookingRules = {
  slotMinutes: SLOT_MINUTES,
  advanceDays: 7,
  cancelDeadlineMinutes: 120,
  checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15,
  checkOutGraceMinutes: 30,
  maxActiveReservationsPerUser: 3,
  timezone: 'Asia/Shanghai',
}
