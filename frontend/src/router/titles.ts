// 浏览器标签页标题（UI-2b 已定事项第 4 条）：“页面名 - 校园场馆预约与服务管理系统”，页面名取匹配到的最内层带 meta.title 的路由记录；
// 没有页面名（例如未知路径，它们会被重定向）时只显示项目名。管理端顶栏的当前页面名也取同一个 meta.title。
import type { RouteLocationNormalized } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export const APP_NAME = '校园场馆预约与服务管理系统'

// 匹配到的最内层带标题的路由记录的页面名；没有则为 null。
export function pageTitleOf(location: Pick<RouteLocationNormalized, 'matched'>): string | null {
  return [...location.matched].reverse().find((record) => record.meta.title !== undefined)?.meta.title ?? null
}

export function documentTitle(location: Pick<RouteLocationNormalized, 'matched'>): string {
  const page = pageTitleOf(location)
  return page === null ? APP_NAME : `${page} - ${APP_NAME}`
}
