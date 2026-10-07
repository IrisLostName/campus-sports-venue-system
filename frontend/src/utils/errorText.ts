// 把任意被抛出的对象转成“错误码 + 中文文案”。ApiError 按 code 查文案（docs/12 第 3 节），其余按 INTERNAL_ERROR。
import { ApiError } from '../api/errors'
import { messageFor } from './errorMessages'

export interface ErrorText {
  code: string
  message: string
}

export function describeError(error: unknown): ErrorText {
  if (error instanceof ApiError) {
    return { code: error.code, message: messageFor(error.code, error.message) }
  }
  return { code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') }
}
