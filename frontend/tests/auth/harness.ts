// FE-2 测试脚手架：Pinia + 内存路由 + mock ApiClient（注入时钟），全部在 Node 环境运行，不用真实时间与浏览器。
import { createPinia } from 'pinia'
import { createMemoryHistory, type Router } from 'vue-router'

import type { ApiClient } from '../../src/api/client'
import type { UserProfile } from '../../src/api/types'
import { createMockClient } from '../../src/api/mock/index'
import { createSeedState, DEMO_PASSWORD } from '../../src/api/mock/seed'
import type { MockState } from '../../src/api/mock/state'
import { createAppRouter } from '../../src/router/factory'
import type { RouteViews } from '../../src/router/routes'
import { defineAuthStore, type AuthStore, type TokenStorage } from '../../src/stores/auth'
import { createFakeClock, type FakeClock } from '../api/support/harness'

export { DEMO_PASSWORD }

export const START = '2026-10-12T09:00:00'

export class MemoryStorage implements TokenStorage {
  readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

const STUB = { render: () => null }
export const STUB_VIEWS: RouteViews = {
  login: STUB, clientShell: STUB, home: STUB, reservation: STUB, booking: STUB, me: STUB,
  venueAdmin: STUB, sysAdmin: STUB, display: STUB,
}

// reload 时可覆盖的部分：store 看到的“现在”（与 mock 服务端时钟分开，用来制造“本地未过期、服务端已过期”），以及 getMe 的实现。
export interface ReloadOptions {
  now?: () => string
  getMe?: () => Promise<UserProfile>
}

// 一次“页面加载”之间可以保留的东西：时钟、mock 数据（含令牌表）、storage。
interface Persisted {
  clock: FakeClock
  state: MockState
  storage: MemoryStorage
}

export interface AuthHarness {
  clock: FakeClock
  storage: MemoryStorage
  auth: AuthStore
  router: Router
  api: ApiClient
  // 本次“页面加载”中 getMe 被调用的次数（用来证明已过期的令牌根本不会发出校验请求）。
  getMeCalls(): number
  // API 层此刻能读到的令牌（即 setTokenProvider 收到的函数的返回值）。
  tokenSeenByApi(): string | null
  // 以系统管理员身份停用账号（使用独立的 mock 客户端，不经过被测 store）。
  disableAccount(username: string): Promise<void>
  // 模拟刷新页面：新的 Pinia、store 与路由，沿用 storage、mock 数据与时钟。
  reload(options?: ReloadOptions): AuthHarness
}

function build(persisted: Persisted, options: ReloadOptions = {}): AuthHarness {
  const { clock, state, storage } = persisted
  let provider: () => string | null = () => null
  const mock = createMockClient({ getToken: () => provider(), clock, state })
  let getMeCalls = 0
  const api: ApiClient = { ...mock, getMe: () => { getMeCalls += 1; return options.getMe === undefined ? mock.getMe() : options.getMe() } }
  const useAuth = defineAuthStore({
    api, storage, now: options.now ?? (() => clock.now()), setTokenProvider: (next) => { provider = next },
  })
  const auth = useAuth(createPinia())
  const router = createAppRouter({ history: createMemoryHistory(), views: STUB_VIEWS, getAuth: () => auth })

  return {
    clock, storage, auth, router, api,
    getMeCalls: () => getMeCalls,
    tokenSeenByApi: () => provider(),
    async disableAccount(username) {
      let adminToken: string | null = null
      const admin = createMockClient({ getToken: () => adminToken, clock, state })
      adminToken = (await admin.login({ username: 'sysadmin', password: DEMO_PASSWORD })).token
      const users = await admin.adminListUsers({ pageSize: 100 })
      const target = users.items.find((item) => item.username === username)
      if (target === undefined) {
        throw new Error(`种子数据里没有账号 ${username}`)
      }
      await admin.adminUpdateUser(target.id, { status: 'DISABLED' })
    },
    reload: (next) => build(persisted, next),
  }
}

export function createAuthHarness(): AuthHarness {
  const clock = createFakeClock(START)
  return build({ clock, state: createSeedState(clock), storage: new MemoryStorage() })
}
