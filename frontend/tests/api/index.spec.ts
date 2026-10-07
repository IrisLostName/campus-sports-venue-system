// api/index.ts：按 VITE_API_MODE 选择实现、令牌提供者、http 失败不回退到 mock（docs/02 第 3.3 节；ADR-0006）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { api, resolveMode, selectApi, setTokenProvider } from '../../src/api/index'
import { API_CLIENT_METHODS } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { DEMO_PASSWORD } from '../../src/api/mock/seed'
import { createFakeClock, NOW } from './support/harness'
import { createFetchStub } from './support/fetchStub'

const deps = (overrides: Partial<Parameters<typeof selectApi>[1]> = {}) => ({
  getToken: () => null, baseUrl: 'http://localhost:8080', clock: createFakeClock(NOW), ...overrides,
})

describe('resolveMode', () => {
  it('未设置或为空时默认 mock（docs/02 第 3.3 节）', () => {
    expect(resolveMode(undefined)).toBe('mock')
    expect(resolveMode('')).toBe('mock')
  })

  it('mock 与 http 原样返回', () => {
    expect(resolveMode('mock')).toBe('mock')
    expect(resolveMode('http')).toBe('http')
  })

  it.each(['HTTP', 'real', 'mock ', 'prod'])('未知取值 %s 直接抛错，不静默回退', (raw) => {
    expect(() => resolveMode(raw)).toThrow(/VITE_API_MODE/)
  })
})

describe('selectApi', () => {
  it.each(['mock', 'http'] as const)('%s 模式暴露同一组 42 个方法', (mode) => {
    const client = selectApi(mode, deps())
    expect(Object.keys(client).sort()).toEqual([...API_CLIENT_METHODS].sort())
  })

  it('mock 模式使用内存数据：演示账号可登录', async () => {
    const client = selectApi('mock', deps())
    expect((await client.login({ username: 'zhangsan', password: DEMO_PASSWORD })).user.username).toBe('zhangsan')
  })

  it('http 模式请求 baseUrl 下的 /api/v1，并携带 getToken 的令牌', async () => {
    const stub = createFetchStub({ status: 200, json: { id: 1 } })
    const client = selectApi('http', deps({ getToken: () => 'tok', fetchImpl: stub.fetchImpl }))
    await client.getMe()
    expect(stub.calls[0]).toMatchObject({ url: 'http://localhost:8080/api/v1/auth/me', method: 'GET' })
    expect(stub.calls[0]?.headers.Authorization).toBe('Bearer tok')
  })

  it('http 模式失败必须抛 ApiError，不回退到 mock 数据', async () => {
    const stub = createFetchStub({ failure: new TypeError('connection refused') })
    const client = selectApi('http', deps({ fetchImpl: stub.fetchImpl }))
    const error = await client.listVenues().then(() => undefined, (cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'INTERNAL_ERROR' })
  })
})

describe('setTokenProvider 与 api 实例', () => {
  afterEach(() => setTokenProvider(() => null))

  it('默认没有令牌：受保护接口 AUTH_REQUIRED', async () => {
    await expect(api.getMe()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
  })

  it('注入令牌提供者后，api 以该令牌访问', async () => {
    const session = await api.login({ username: 'lisi', password: DEMO_PASSWORD })
    setTokenProvider(() => session.token)
    expect((await api.getMe()).username).toBe('lisi')
  })

  it('api/index.ts 不导入 stores（避免循环依赖，令牌由 auth store 通过 setTokenProvider 注入）', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/api/index.ts', import.meta.url)), 'utf8')
    expect(source).not.toMatch(/from\s+['"][^'"]*stores/)
  })
})
