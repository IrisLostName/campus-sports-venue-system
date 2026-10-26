// 组装路由：路由表 + 认证守卫 + 标签页标题。应用与测试共用，区别只在历史模式、视图与认证状态来源。
import { createRouter, type Router, type RouterHistory } from 'vue-router'

import { createAuthGuard, type GuardAuth } from './guard'
import { buildRoutes, type RouteViews } from './routes'
import { documentTitle } from './titles'

export interface RouterOptions {
  history: RouterHistory
  views: RouteViews
  getAuth: () => GuardAuth
}

export function createAppRouter(options: RouterOptions): Router {
  const router = createRouter({ history: options.history, routes: buildRoutes(options.views) })
  router.beforeEach(createAuthGuard(options.getAuth))
  // 导航成功后设置标签页标题（UI-2b）；在没有 document 的环境（node 测试）里不设置。
  router.afterEach((to, _from, failure) => {
    if (failure === undefined && typeof document !== 'undefined') {
      document.title = documentTitle(to)
    }
  })
  return router
}
