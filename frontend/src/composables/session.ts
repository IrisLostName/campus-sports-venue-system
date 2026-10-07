// 登录状态失效与登出的统一处理（docs/12 第 7 节），本包与之后的页面共用。
// 页面调用 api 时用 callApi 包一层，遇到 TOKEN_EXPIRED / AUTH_REQUIRED / ACCOUNT_DISABLED 会自动清除登录状态并回到登录页。
import { useRouter, type Router } from 'vue-router'

import { ApiError } from '../api/errors'
import { decideNavigation, loginLocation } from '../router/access'
import { useAuthStore } from '../stores/auth'
import { describeError } from '../utils/errorText'
import { isSessionFailure } from '../utils/sessionErrors'

export interface SessionAuth {
  invalidate(code: string): void
  logout(): void
}

export interface SessionDeps {
  auth: SessionAuth
  router: Router
}

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string; sessionEnded: boolean }

// 把 callApi 绑定好 deps 的形式，供 store 与控制器接收（它们不直接持有 router）。凡需登录的调用都必须经它（FE-2 审计 N-1）。
export type ApiCaller = <T>(request: () => Promise<T>) => Promise<ApiResult<T>>

// 是登录状态失效类错误则处理并返回 true；其他错误原样返回 false，由调用方展示。
// TOKEN_EXPIRED / AUTH_REQUIRED：回登录页并带返回地址；ACCOUNT_DISABLED：回登录页，不带返回地址（该账号无法再登录）。
export async function handleAuthFailure(error: unknown, deps: SessionDeps): Promise<boolean> {
  if (!(error instanceof ApiError) || !isSessionFailure(error.code)) {
    return false
  }
  const current = deps.router.currentRoute.value
  deps.auth.invalidate(error.code)
  const decision = decideNavigation(current, null)
  if (decision !== true) {
    await deps.router.replace(error.code === 'ACCOUNT_DISABLED' ? loginLocation() : decision)
  }
  return true
}

export async function callApi<T>(request: () => Promise<T>, deps: SessionDeps): Promise<ApiResult<T>> {
  try {
    return { ok: true, value: await request() }
  } catch (error) {
    const sessionEnded = await handleAuthFailure(error, deps)
    return { ok: false, ...describeError(error), sessionEnded }
  }
}

export async function logoutToLogin(deps: SessionDeps): Promise<void> {
  deps.auth.logout()
  await deps.router.replace(loginLocation())
}

export function useSession() {
  const deps: SessionDeps = { auth: useAuthStore(), router: useRouter() }
  return {
    handleAuthFailure: (error: unknown) => handleAuthFailure(error, deps),
    callApi: <T>(request: () => Promise<T>) => callApi(request, deps),
    caller: (): ApiCaller => (request) => callApi(request, deps),
    logout: () => logoutToLogin(deps),
  }
}
