// docs/12 第 5.1 节 POST /auth/password-reset（v1.3）、docs/10 第 4a 节：格式 → 锁定 → 核对。
// 尝试按请求中的用户名字符串记录，与账号是否存在无关（不存在的用户名与真实账号表现一致）；
// 失败次数只数过去 24 小时内、且在该用户名最近一次成功之后的失败。
import type { ApiClient } from '../client'
import type { PasswordResetRequest } from '../requests'
import { passwordProblem } from './authService'
import { fail } from './fail'
import { run } from './run'
import type { MockContext, ResetAttemptRecord } from './state'
import { addHours, secondsOf } from './timeMath'
import { collect, phoneProblem, textProblem } from './validate'

export const RESET_MAX_FAILURES = 7
const RESET_WINDOW_HOURS = 24

// 计入的失败，按尝试先后排列。最早一次失败满 24 小时的那一刻起不再计入（即 unlocksAt）。
function countedFailures(ctx: MockContext, username: string, now: string): ResetAttemptRecord[] {
  const own = ctx.state.resetAttempts.filter((attempt) => attempt.username === username)
  let afterSuccess = 0
  own.forEach((attempt, index) => {
    if (attempt.succeeded) {
      afterSuccess = index + 1
    }
  })
  const windowStart = secondsOf(now) - RESET_WINDOW_HOURS * 3600
  return own.slice(afterSuccess).filter((attempt) => secondsOf(attempt.attemptedAt) > windowStart)
}

function resetPassword(ctx: MockContext, request: PasswordResetRequest): void {
  collect([
    ['username', textProblem(request.username, 32)],
    ['displayName', textProblem(request.displayName, 50)],
    ['phone', phoneProblem(request.phone)],
    ['newPassword', passwordProblem(request.newPassword)],
  ])
  const now = ctx.clock.now()
  const failures = countedFailures(ctx, request.username, now)
  const earliest = failures[0]
  if (earliest !== undefined && failures.length >= RESET_MAX_FAILURES) {
    fail('PASSWORD_RESET_LOCKED', { unlocksAt: addHours(earliest.attemptedAt, RESET_WINDOW_HOURS) })
  }
  const user = ctx.state.users.find((candidate) => candidate.username === request.username)
  const matched = user !== undefined && user.status === 'ACTIVE' && user.role === 'USER'
    && user.displayName === request.displayName && user.phone === request.phone
  ctx.state.resetAttempts.push({ username: request.username, attemptedAt: now, succeeded: matched })
  if (user === undefined || !matched) {
    fail('RESET_INFO_MISMATCH', { remainingAttempts: RESET_MAX_FAILURES - failures.length - 1 })
  }
  user.password = request.newPassword
  user.passwordChangedAt = now
}

export function passwordResetApi(ctx: MockContext): Pick<ApiClient, 'resetPassword'> {
  return {
    resetPassword: (request) => run(ctx, () => resetPassword(ctx, request)),
  }
}
