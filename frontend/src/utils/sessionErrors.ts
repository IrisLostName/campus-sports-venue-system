// docs/12 第 7 节：这三个错误码意味着当前登录状态已不可用，需要清除登录状态。
export const SESSION_FAILURE_CODES = ['TOKEN_EXPIRED', 'AUTH_REQUIRED', 'ACCOUNT_DISABLED'] as const

export type SessionFailureCode = (typeof SESSION_FAILURE_CODES)[number]

export function isSessionFailure(code: string): code is SessionFailureCode {
  return (SESSION_FAILURE_CODES as readonly string[]).includes(code)
}
