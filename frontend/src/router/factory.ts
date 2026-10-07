// 组装路由：路由表 + 认证守卫。应用与测试共用，区别只在历史模式、视图与认证状态来源。
import { createRouter, type Router, type RouterHistory } from 'vue-router'

import { createAuthGuard, type GuardAuth } from './guard'
import { buildRoutes, type RouteViews } from './routes'

export interface RouterOptions {
  history: RouterHistory
  views: RouteViews
  getAuth: () => GuardAuth
}

export function createAppRouter(options: RouterOptions): Router {
  const router = createRouter({ history: options.history, routes: buildRoutes(options.views) })
  router.beforeEach(createAuthGuard(options.getAuth))
  return router
}
