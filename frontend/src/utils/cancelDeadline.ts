// 取消按钮的可用性（docs/03 第 4.4 节“取消按钮的可用性”，TEST-2 K3）：界面提示，不是状态，不改变 displayStatus。
// 以客户端时间判断；最终以后端为准（CANCEL_DEADLINE_PASSED 照常处理）。
// 边界与后端一致：距开始正好 cancelDeadlineMinutes 时仍可取消，不足时才置灰。
import type { BookingRules, Reservation } from '../api/types'

const SECONDS_PER_MINUTE = 60

// YYYY-MM-DD + HH:mm[:ss] 按同一时区的“墙上时间”换算成秒，只用于两者相减。
function wallClockSeconds(date: string, time: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute, second) / 1000
}

// now 为场馆本地时间戳 YYYY-MM-DDTHH:mm:ss（与 nowShanghai() 同格式）。
export function secondsUntilStart(reservation: Pick<Reservation, 'serviceDate' | 'startTime'>, now: string): number {
  const [date = '', time = ''] = now.split('T')
  return wallClockSeconds(reservation.serviceDate, reservation.startTime) - wallClockSeconds(date, time)
}

type LockInput = Pick<Reservation, 'displayStatus' | 'serviceDate' | 'startTime'>

// 只有 UPCOMING 且距开始不足 cancelDeadlineMinutes 时置灰。
// 后端给出 UPCOMING 说明服务端时间尚未进入签到窗口；客户端时间若已进入签到窗口（或已过开始），
// 说明两边时钟不一致，此时不置灰，交给后端裁决。规则尚未取得时不置灰。
export function isCancelLocked(reservation: LockInput, rules: BookingRules | null, now: string): boolean {
  if (rules === null || reservation.displayStatus !== 'UPCOMING') {
    return false
  }
  const left = secondsUntilStart(reservation, now)
  return left < rules.cancelDeadlineMinutes * SECONDS_PER_MINUTE
    && left > rules.checkInOpenBeforeMinutes * SECONDS_PER_MINUTE
}

export function cancelLockedNote(rules: BookingRules): string {
  return `已过可取消时间（需在开始前至少 ${rules.cancelDeadlineMinutes} 分钟取消）`
}
