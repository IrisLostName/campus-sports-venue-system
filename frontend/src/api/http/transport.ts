// http 实现的传输层：URL、请求头、响应解析与错误映射（docs/12 第 1、7 节；规划裁决 A16）。
import { ApiError } from '../errors'
import { ERROR_MESSAGES } from '../../utils/errorMessages'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestSpec {
  method: HttpMethod
  path: string                // 相对于 /api/v1，以 / 开头
  query?: object
  body?: unknown
  auth?: boolean              // 默认 true；公开接口传 false，不携带 Token
}

export interface Transport {
  request<T>(spec: RequestSpec): Promise<T>
}

export interface TransportOptions {
  baseUrl: string             // VITE_API_BASE_URL：后端根地址，不含 /api/v1
  getToken: () => string | null
  fetchImpl: typeof fetch
}

const API_PREFIX = '/api/v1'

export function buildUrl(baseUrl: string, path: string, query?: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}${path}${suffix}`
}

function buildHeaders(spec: RequestSpec, token: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (spec.body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8'
  }
  if (spec.auth !== false && token !== null) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function isErrorBody(value: unknown): value is { code: string; message?: unknown; details?: unknown } {
  return typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string'
}

function isDetails(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// 有 ErrorBody 则原样透传（包括未知 code）；否则按 INTERNAL_ERROR 处理，状态取响应状态。
export function mapErrorResponse(status: number, text: string): ApiError {
  const body = parseJson(text)
  if (isErrorBody(body)) {
    const message = typeof body.message === 'string' ? body.message : ERROR_MESSAGES.INTERNAL_ERROR
    return new ApiError(status, body.code, message, isDetails(body.details) ? body.details : undefined)
  }
  return new ApiError(status, 'INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR)
}

export function mapNetworkError(cause: unknown): ApiError {
  const reason = cause instanceof Error ? cause.message : String(cause)
  return new ApiError(0, 'INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, { reason })
}

function parseSuccess<T>(status: number, text: string): T {
  if (status === 204 || text.trim() === '') {
    return undefined as T
  }
  const body = parseJson(text)
  if (body === undefined) {
    throw new ApiError(status, 'INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR)
  }
  return body as T
}

export function createTransport(options: TransportOptions): Transport {
  return {
    async request<T>(spec: RequestSpec): Promise<T> {
      const init: RequestInit = {
        method: spec.method,
        headers: buildHeaders(spec, options.getToken()),
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
      }
      let response: Response
      let text: string
      try {
        response = await options.fetchImpl(buildUrl(options.baseUrl, spec.path, spec.query), init)
        text = await response.text()
      } catch (cause) {
        throw mapNetworkError(cause)
      }
      if (!response.ok) {
        throw mapErrorResponse(response.status, text)
      }
      return parseSuccess<T>(response.status, text)
    },
  }
}
