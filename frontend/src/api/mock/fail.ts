// mock 抛错入口：状态码取 docs/12 第 3 节，文案取错误码表。
import { ApiError } from '../errors'
import { ERROR_HTTP_STATUS, type ErrorCode } from '../types'
import { ERROR_MESSAGES } from '../../utils/errorMessages'

export function fail(code: ErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(ERROR_HTTP_STATUS[code], code, ERROR_MESSAGES[code], details)
}
