// SEC-2c 找回密码的文案（第 3 节答复第 1、2 条）：剩余次数、次数用完、解锁时刻向上取整。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { formatUnlockTime, lockedText, mismatchText, resetErrorText } from '../../src/utils/passwordResetDisplay'

describe('剩余次数', () => {
  it.each([
    [6, '信息不匹配，剩余可尝试 6 次'],
    [1, '信息不匹配，剩余可尝试 1 次'],
    [0, '信息不匹配，尝试次数已用完，请 24 小时后再试或联系系统管理员'],
    [undefined, '信息不匹配'],
    [-1, '信息不匹配'],
    [2.5, '信息不匹配'],
    ['3', '信息不匹配'],
  ])('%s → %s', (remaining, text) => {
    expect(mismatchText(remaining)).toBe(text)
  })
})

describe('解锁时刻', () => {
  it.each([
    ['2026-10-30T14:05:00', '2026-10-30 14:05'],
    ['2026-10-30T14:05:01', '2026-10-30 14:06'],
    ['2026-10-30T14:59:59', '2026-10-30 15:00'],
    ['2026-12-31T23:59:30', '2027-01-01 00:00'],
    ['2026-10-30 14:05:00', null],
    ['2026-10-30T14:05', null],
  ])('%s → %s', (timestamp, text) => {
    expect(formatUnlockTime(timestamp)).toBe(text)
  })

  it('文案；unlocksAt 缺失或格式不对时退回不带时刻的文案', () => {
    expect(lockedText('2026-10-30T14:05:30')).toBe('尝试次数过多，请在 2026-10-30 14:06 之后再试，或联系系统管理员')
    expect(lockedText(undefined)).toBe('尝试次数过多，请稍后再试，或联系系统管理员')
    expect(lockedText('soon')).toBe('尝试次数过多，请稍后再试，或联系系统管理员')
  })
})

describe('错误到文案', () => {
  it('两个找回密码错误码按 details 拼文案；其余按错误码表；非 ApiError 按 INTERNAL_ERROR', () => {
    expect(resetErrorText(new ApiError(400, 'RESET_INFO_MISMATCH', 'x', { remainingAttempts: 4 }))).toBe('信息不匹配，剩余可尝试 4 次')
    expect(resetErrorText(new ApiError(429, 'PASSWORD_RESET_LOCKED', 'x', { unlocksAt: '2026-10-30T14:05:00' })))
      .toBe('尝试次数过多，请在 2026-10-30 14:05 之后再试，或联系系统管理员')
    expect(resetErrorText(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe('请求参数不合法')
    expect(resetErrorText(new Error('boom'))).toBe('服务器开小差了，请稍后再试')
  })
})
