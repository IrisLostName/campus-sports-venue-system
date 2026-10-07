// 页面、组件、store 获取数据的唯一入口（docs/02 第 3.2 节；ADR-0006）。
// 由 VITE_API_MODE=mock|http 选择实现；http 模式失败必须抛错，不得回退到 mock（docs/16 第 5 节第 12 项）。
import type { ApiClient } from './client'
import { createHttpClient } from './http'
import { createMockClient } from './mock/index'
import type { Clock } from './mock/clock'

export type ApiMode = 'mock' | 'http'
export type TokenProvider = () => string | null

// docs/02 第 3.3 节：VITE_API_MODE 本地默认 mock；VITE_API_BASE_URL 本地默认 http://localhost:8080。
const DEFAULT_MODE: ApiMode = 'mock'
const DEFAULT_BASE_URL = 'http://localhost:8080'

export interface ApiDeps {
  getToken: TokenProvider
  baseUrl: string
  fetchImpl?: typeof fetch      // 仅 http 模式使用，测试注入替身
  clock?: Clock                 // 仅 mock 模式使用，测试注入固定时钟
}

export function resolveMode(raw: string | undefined): ApiMode {
  if (raw === undefined || raw === '') {
    return DEFAULT_MODE
  }
  if (raw === 'mock' || raw === 'http') {
    return raw
  }
  throw new Error(`VITE_API_MODE 只能是 mock 或 http，收到：${raw}`)
}

export function selectApi(mode: ApiMode, deps: ApiDeps): ApiClient {
  if (mode === 'http') {
    return createHttpClient({ baseUrl: deps.baseUrl, getToken: deps.getToken, fetchImpl: deps.fetchImpl })
  }
  return createMockClient({ getToken: deps.getToken, clock: deps.clock })
}

// auth store（FE-2）登录后调用 setTokenProvider 注入读取令牌的函数；此前默认没有令牌。本文件不导入 stores。
let tokenProvider: TokenProvider = () => null

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

export const api: ApiClient = selectApi(resolveMode(import.meta.env.VITE_API_MODE), {
  getToken: () => tokenProvider(),
  baseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL,
})
