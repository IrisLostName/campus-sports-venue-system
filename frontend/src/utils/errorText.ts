// 把任意被抛出的对象转成“错误码 + 中文文案”。ApiError 按 code 查文案（docs/12 第 3 节），其余按 INTERNAL_ERROR。
import { ApiError } from '../api/errors'
import { messageFor } from './errorMessages'

export interface ErrorText {
  code: string
  message: string
}

// RULE_INVALID 的 details.reason 说明具体违反了哪条开放规则：存在且非空时原样接在通用文案后面（FE-8 L8）。
function reasonOf(error: ApiError): string | null {
  const reason: unknown = error.details?.reason
  return error.code === 'RULE_INVALID' && typeof reason === 'string' && reason.trim() !== '' ? reason : null
}

export function describeError(error: unknown): ErrorText {
  if (error instanceof ApiError) {
    const message = messageFor(error.code, error.message)
    const reason = reasonOf(error)
    return { code: error.code, message: reason === null ? message : `${message}：${reason}` }
  }
  return { code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') }
}
