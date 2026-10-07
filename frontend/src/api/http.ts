// 基于 fetch 的 ApiClient 实现（ADR-0006）：路径、方法、请求体、错误映射见 docs/12 第 1、5 节。
// 失败一律抛出 ApiError，不回退到 mock（docs/16 第 5 节第 12 项）。
import type { ApiClient, ApiClientOptions } from './client'
import { adminOpsApi } from './http/adminOps'
import { adminVenueApi } from './http/adminVenue'
import { createTransport } from './http/transport'
import { userApi } from './http/user'

export interface HttpClientOptions extends ApiClientOptions {
  baseUrl: string               // VITE_API_BASE_URL
  fetchImpl?: typeof fetch      // 测试注入替身 fetch；缺省为全局 fetch
}

export function createHttpClient(options: HttpClientOptions): ApiClient {
  const transport = createTransport({
    baseUrl: options.baseUrl,
    getToken: options.getToken,
    fetchImpl: options.fetchImpl ?? ((input, init) => fetch(input, init)),
  })
  return { ...userApi(transport), ...adminVenueApi(transport), ...adminOpsApi(transport) }
}
