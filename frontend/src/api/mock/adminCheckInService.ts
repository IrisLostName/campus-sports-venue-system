// v1.1 扫码签到（docs/12 第 5.7 节 POST /admin/check-ins；docs/10 第 4 节），与后端 AdminCheckInService 同序：
// 认证 → 格式（code 非空白、≤ 100、符合签到码格式，否则 VALIDATION_ERROR fields.code；不去除首尾空白）→ 角色 VA / SA →
// 签到码（预约不存在或签到标识与预约人不符，一律 CHECKIN_CODE_INVALID，不带 details）→ 范围 FORBIDDEN_SCOPE →
// 有效状态 CONFIRMED（INVALID_STATE）→ 签到窗口闭区间（CHECKIN_WINDOW_CLOSED）→ 尚未签到（ALREADY_CHECKED_IN）→ 写入签到时间。
// 成功返回 AdminReservation；不写管理员操作日志。
import type { ApiClient } from '../client'
import type { AdminCheckInRequest } from '../requests'
import type { AdminReservation } from '../typesSection5'
import { CHECK_IN_CODE_PATTERN, parseCheckInCode } from './checkInCodes'
import { fail } from './fail'
import { authenticate, requireRole, requireScope } from './guards'
import { checkInWindow, nowSeconds, toAdminReservation, venueIdOfReservation } from './reservationView'
import { run } from './run'
import type { MockContext, ReservationRecord } from './state'
import { secondsOf } from './timeMath'
import { collect, textProblem } from './validate'

const CODE_MAX_LENGTH = 100

function codeProblem(value: unknown): string | null {
  const problem = textProblem(value, CODE_MAX_LENGTH)
  if (problem !== null) {
    return problem
  }
  return CHECK_IN_CODE_PATTERN.test(value as string) ? null : '签到码格式不正确'
}

function reservationOfCode(ctx: MockContext, code: string): ReservationRecord {
  const parsed = parseCheckInCode(code)
  const record = parsed === null ? undefined : ctx.state.reservations.find((item) => item.id === parsed.reservationId)
  const owner = record === undefined ? undefined : ctx.state.users.find((user) => user.id === record.userId)
  if (parsed === null || record === undefined || owner?.checkInUuid.toLowerCase() !== parsed.checkInUuid) {
    return fail('CHECKIN_CODE_INVALID')
  }
  return record
}

function adminCheckIn(ctx: MockContext, request: AdminCheckInRequest): AdminReservation {
  const user = authenticate(ctx)
  collect([['code', codeProblem(request.code)]])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const record = reservationOfCode(ctx, request.code)
  requireScope(ctx, user, venueIdOfReservation(ctx, record))
  if (record.status !== 'CONFIRMED') {
    fail('INVALID_STATE', { status: record.status })
  }
  const window = checkInWindow(ctx, record)
  const now = nowSeconds(ctx)
  if (now < secondsOf(window.opensAt) || now > secondsOf(window.closesAt)) {
    fail('CHECKIN_WINDOW_CLOSED', window)
  }
  if (record.checkInAt !== null) {
    fail('ALREADY_CHECKED_IN')
  }
  record.checkInAt = ctx.clock.now()
  return toAdminReservation(ctx, record)
}

export function adminCheckInApi(ctx: MockContext): Pick<ApiClient, 'adminCheckIn'> {
  return {
    adminCheckIn: (request) => run(ctx, () => adminCheckIn(ctx, request ?? ({} as AdminCheckInRequest))),
  }
}
