// 登录状态：令牌、过期时间、当前用户；登录、注册、登出；启动时从 storage 恢复（docs/12 第 5.1 节）。
// 令牌的读写只允许出现在本文件（scripts/check-code.mjs 检查）。登出由前端丢弃令牌完成，后端不提供接口。
import { defineStore } from 'pinia'
import { computed, ref, type Ref } from 'vue'

import { api, setTokenProvider } from '../api/index'
import type { ApiClient } from '../api/client'
import type { LoginRequest, RegisterRequest } from '../api/requests'
import type { UserProfile } from '../api/types'
import type { LoginResponse } from '../api/typesSection5'
import { describeError } from '../utils/errorText'
import { messageFor } from '../utils/errorMessages'
import { isTimestamp, nowShanghai } from '../utils/shanghaiTime'

const STORAGE_KEY = 'campus-venue.auth'

export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface AuthDeps {
  api: ApiClient
  storage: TokenStorage
  now: () => string                                        // 场馆本地时间戳，用于判断令牌是否过期
  setTokenProvider: (provider: () => string | null) => void
}

export type AuthResult =
  | { ok: true; user: UserProfile }
  | { ok: false; code: string; message: string }

interface StoredSession {
  token: string
  expiresAt: string
}

interface SessionRefs {
  token: Ref<string | null>
  expiresAt: Ref<string | null>
  user: Ref<UserProfile | null>
  notice: Ref<string | null>      // 登录页展示的一次性提示（过期、未登录、账号停用）
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Partial<Record<keyof StoredSession, unknown>>
  return typeof candidate.token === 'string' && candidate.token !== '' && isTimestamp(candidate.expiresAt)
}

function readStored(storage: TokenStorage): StoredSession | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

// 浏览器 localStorage；不可用（隐私模式、被禁用）时退回内存，页面刷新后需重新登录。
export function createBrowserStorage(): TokenStorage {
  const fallback = new Map<string, string>()
  return {
    getItem(key) {
      try {
        return localStorage.getItem(key) ?? fallback.get(key) ?? null
      } catch {
        return fallback.get(key) ?? null
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        fallback.set(key, value)
      }
    },
    removeItem(key) {
      fallback.delete(key)
      try {
        localStorage.removeItem(key)
      } catch {
        return
      }
    },
  }
}

function clearSession(deps: AuthDeps, refs: SessionRefs): void {
  refs.token.value = null
  refs.expiresAt.value = null
  refs.user.value = null
  deps.storage.removeItem(STORAGE_KEY)
}

function adoptSession(deps: AuthDeps, refs: SessionRefs, session: LoginResponse): void {
  refs.token.value = session.token
  refs.expiresAt.value = session.expiresAt
  refs.user.value = session.user
  deps.storage.setItem(STORAGE_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt }))
}

// 恢复失败时登录页要给出的提示（FE-2 审计 N-2）：过期与账号停用有文案；AUTH_REQUIRED（无效令牌）与网络失败静默清除。
const RESTORE_NOTICE_CODES: readonly string[] = ['TOKEN_EXPIRED', 'ACCOUNT_DISABLED']

// 恢复规则：没有 → 静默清除；本地判定已过期 → 清除并提示过期（不发请求）；否则带着令牌调用 getMe 校验并刷新用户，失败则清除并按错误码提示。
async function restoreFromStorage(deps: AuthDeps, refs: SessionRefs): Promise<void> {
  const stored = readStored(deps.storage)
  if (stored === null) {
    clearSession(deps, refs)
    return
  }
  if (stored.expiresAt <= deps.now()) {
    clearSession(deps, refs)
    refs.notice.value = messageFor('TOKEN_EXPIRED')
    return
  }
  refs.token.value = stored.token
  refs.expiresAt.value = stored.expiresAt
  try {
    const profile = await deps.api.getMe()
    if (refs.token.value === stored.token) {
      refs.user.value = profile
    }
  } catch (error) {
    // 恢复期间若已经重新登录（令牌变了），这次校验的结果作废。
    if (refs.token.value === stored.token) {
      const { code } = describeError(error)
      clearSession(deps, refs)
      refs.notice.value = RESTORE_NOTICE_CODES.includes(code) ? messageFor(code) : null
    }
  }
}

export function defineAuthStore(deps: AuthDeps) {
  return defineStore('auth', () => {
    const refs: SessionRefs = {
      token: ref<string | null>(null),
      expiresAt: ref<string | null>(null),
      user: ref<UserProfile | null>(null),
      notice: ref<string | null>(null),
    }
    const role = computed(() => refs.user.value?.role ?? null)
    const isAuthenticated = computed(() => refs.user.value !== null)
    let restoring: Promise<void> | null = null

    // 令牌只由本 store 持有，API 层通过这个函数读取（FE-1 规划裁决 A2）。
    deps.setTokenProvider(() => refs.token.value)

    // 启动恢复：只执行一次，路由守卫等待它完成后再判定。
    function restore(): Promise<void> {
      restoring ??= restoreFromStorage(deps, refs)
      return restoring
    }

    async function authenticate(request: () => Promise<LoginResponse>): Promise<AuthResult> {
      refs.notice.value = null
      try {
        const session = await request()
        adoptSession(deps, refs, session)
        restoring ??= Promise.resolve()
        return { ok: true, user: session.user }
      } catch (error) {
        return { ok: false, ...describeError(error) }
      }
    }

    function login(request: LoginRequest): Promise<AuthResult> {
      return authenticate(() => deps.api.login(request))
    }

    function register(request: RegisterRequest): Promise<AuthResult> {
      return authenticate(() => deps.api.register(request))
    }

    function logout(): void {
      clearSession(deps, refs)
      refs.notice.value = null
    }

    // 令牌失效（TOKEN_EXPIRED / AUTH_REQUIRED / ACCOUNT_DISABLED）：清除登录状态，并留下提示给登录页。
    function invalidate(code: string): void {
      clearSession(deps, refs)
      refs.notice.value = messageFor(code)
    }

    return { ...refs, role, isAuthenticated, restore, login, register, logout, invalidate }
  })
}

export const useAuthStore = defineAuthStore({
  api,
  storage: createBrowserStorage(),
  now: nowShanghai,
  setTokenProvider,
})

export type AuthStore = ReturnType<typeof useAuthStore>
