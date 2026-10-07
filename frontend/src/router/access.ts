// 路由访问规则（docs/02 第 3.1 节、docs/08 第 5 节）。守卫只是体验层，权限由后端裁决。
// 这里都是不依赖浏览器与 Vue 组件的纯函数，Node 环境下可直接测试。
import type { RouteLocationRaw } from 'vue-router'

import type { Role } from '../api/types'
import { DOCK_ITEMS } from './dock'

// public：无需登录；guest：登录页（已登录则回到本角色入口）；fallback：未知路径；其余为所需角色。
export type RouteAccess = Role | 'public' | 'guest' | 'fallback'

declare module 'vue-router' {
  interface RouteMeta {
    access?: RouteAccess
  }
}

const ENTRY_PATHS: Record<Role, string> = {
  USER: '/',
  VENUE_ADMIN: '/venue-admin',
  SYS_ADMIN: '/sys-admin',
}

const USER_PATHS = DOCK_ITEMS.map((item) => item.path)

export function entryPathOf(role: Role): string {
  return ENTRY_PATHS[role]
}

export function loginLocation(redirect?: string): RouteLocationRaw {
  return redirect === undefined ? { path: '/login' } : { path: '/login', query: { redirect } }
}

function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? ''
}

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

export function roleOwnsPath(role: Role, path: string): boolean {
  if (role === 'USER') {
    return USER_PATHS.some((base) => (base === '/' ? path === '/' : isUnder(path, base)))
  }
  return isUnder(path, ENTRY_PATHS[role])
}

// redirect 只接受站内路径（以单个 / 开头），且必须属于刚登录的角色，否则回到该角色入口。
export function resolvePostLoginTarget(role: Role, redirect: unknown): string {
  if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return entryPathOf(role)
  }
  return roleOwnsPath(role, pathOf(redirect)) ? redirect : entryPathOf(role)
}

export interface NavigationTarget {
  fullPath: string
  meta: { access?: RouteAccess }
}

// 返回 true 表示放行，否则返回应跳转的位置。对自己的输出是幂等的。
export function decideNavigation(to: NavigationTarget, role: Role | null): true | RouteLocationRaw {
  const access = to.meta.access ?? 'fallback'
  if (access === 'public') {
    return true
  }
  if (role === null) {
    return access === 'guest' ? true : loginLocation(access === 'fallback' ? undefined : to.fullPath)
  }
  return access === role ? true : entryPathOf(role)
}
