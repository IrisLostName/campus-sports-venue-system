// 找回密码页的文案（SEC-2c 裁决已定事项第 1 条与第 3 节答复第 1–3 条；docs/12 第 3、5.1 节 v1.3）。
import { ApiError } from '../api/errors'
import { describeError } from './errorText'

export const RESET_HINTS = ['24 小时内最多可尝试 7 次。', '如果注册时没有填写手机号，请联系系统管理员。'] as const
export const RESET_SUCCESS_NOTICE = '密码已重置，请用新密码登录'

const MISMATCH_TEXT = '信息不匹配'
const EXHAUSTED_TEXT = '信息不匹配，尝试次数已用完，请 24 小时后再试或联系系统管理员'
const LOCKED_FALLBACK = '尝试次数过多，请稍后再试，或联系系统管理员'
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/

// details.remainingAttempts 为本次计入后的剩余次数；缺失或不是非负整数时只显示“信息不匹配”。
export function mismatchText(remaining: unknown): string {
  if (typeof remaining !== 'number' || !Number.isInteger(remaining) || remaining < 0) {
    return MISMATCH_TEXT
  }
  return remaining === 0 ? EXHAUSTED_TEXT : `${MISMATCH_TEXT}，剩余可尝试 ${remaining} 次`
}

// 2026-10-30T14:05:30 → 2026-10-30 14:06：有秒时向上取整到下一分钟，避免用户提前重试（答复第 2 条）。
// 时间戳不带时区，按字段做日历运算即可（借 UTC 计算进位，不涉及浏览器时区）。
export function formatUnlockTime(timestamp: string): string | null {
  const match = TIMESTAMP_PATTERN.exec(timestamp)
  if (match === null) {
    return null
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number]
  const roundUp = second > 0 ? 1 : 0
  const moment = new Date(Date.UTC(year, month - 1, day, hour, minute + roundUp))
  return moment.toISOString().slice(0, 'YYYY-MM-DDTHH:mm'.length).replace('T', ' ')
}

export function lockedText(unlocksAt: unknown): string {
  const when = typeof unlocksAt === 'string' ? formatUnlockTime(unlocksAt) : null
  return when === null ? LOCKED_FALLBACK : `尝试次数过多，请在 ${when} 之后再试，或联系系统管理员`
}

// 两个找回密码专用错误码按 details 拼文案，其余按错误码表（VALIDATION_ERROR 为“请求参数不合法”）。
export function resetErrorText(error: unknown): string {
  if (error instanceof ApiError && error.code === 'RESET_INFO_MISMATCH') {
    return mismatchText(error.details?.remainingAttempts)
  }
  if (error instanceof ApiError && error.code === 'PASSWORD_RESET_LOCKED') {
    return lockedText(error.details?.unlocksAt)
  }
  return describeError(error).message
}
