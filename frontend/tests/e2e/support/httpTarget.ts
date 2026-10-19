// 对真实后端的 http 目标：前端自己的 createHttpClient，fetch 外面包一层只记录方法、路径与状态码（BE-8 K2）。
// 不改 ApiClient 接口；Node 的 fetch 不发送 Origin，所以这里不涉及 CORS。
import { createHttpClient } from '../../../src/api/http'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import type { ContractTarget } from '../../api/contract/suite'
import { E2E } from './e2eEnv'

export interface StatusRecord {
  method: string
  path: string
  status: number
}

export interface RecordingTarget extends ContractTarget {
  calls: StatusRecord[]
  loginAs(username: string): Promise<void>
}

export function recordingFetch(calls: StatusRecord[]): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init)
    calls.push({ method: init?.method ?? 'GET', path: new URL(String(input)).pathname, status: response.status })
    return response
  }
}

export function makeHttpTarget(calls: StatusRecord[] = []): RecordingTarget {
  let token: string | null = null
  const api = createHttpClient({ baseUrl: E2E.apiBaseUrl, getToken: () => token, fetchImpl: recordingFetch(calls) })
  const setToken = (value: string | null) => { token = value }
  return {
    api,
    calls,
    setToken,
    async loginAs(username) {
      setToken(null)
      setToken((await api.login({ username, password: DEMO_PASSWORD })).token)
    },
  }
}
