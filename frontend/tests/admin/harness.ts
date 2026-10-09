// FE-5 节点测试脚手架：在 FE-2 认证脚手架上登录一个管理员，并给出绑定好 router / auth 的 ApiCaller。
// 全部使用注入时钟（种子里的“今天”是 2026-10-12，明天 2026-10-13），不用真实时间。
import type { ApiClient } from '../../src/api/client'
import { callApi, type ApiCaller } from '../../src/composables/session'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from '../auth/harness'

export const TODAY = '2026-10-12'
export const TOMORROW = '2026-10-13'

export interface AdminContext {
  h: AuthHarness
  call: ApiCaller
  api: ApiClient
}

export async function loginAdmin(username = 'admin_tennis'): Promise<AdminContext> {
  const h = createAuthHarness()
  const result = await h.auth.login({ username, password: DEMO_PASSWORD })
  if (!result.ok) {
    throw new Error(`${username} 登录失败：${result.code}`)
  }
  await h.router.push('/venue-admin')
  const call: ApiCaller = (request) => callApi(request, { auth: h.auth, router: h.router })
  return { h, call, api: h.api }
}

export interface RecordedCall {
  method: string
  args: unknown[]
}

// 记录每次调用的方法名与参数，转发给真实客户端。
export function spyOn(client: ApiClient): { client: ApiClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const proxy = new Proxy(client, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver)
      if (typeof member !== 'function' || typeof key !== 'string') {
        return member
      }
      return (...args: unknown[]) => {
        calls.push({ method: key, args })
        return Reflect.apply(member, target, args)
      }
    },
  })
  return { client: proxy, calls }
}
