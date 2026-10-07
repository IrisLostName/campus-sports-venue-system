// 路由表（docs/02 第 3.1 节）。视图由调用方传入：应用传懒加载组件，测试传替身组件。
import type { RouteComponent, RouteRecordRaw } from 'vue-router'

import { PATHS } from './paths'

type View = RouteComponent | (() => Promise<RouteComponent>)

export interface RouteViews {
  login: View
  clientShell: View
  home: View
  reservation: View
  booking: View
  me: View
  venueAdmin: View
  sysAdmin: View
  display: View
}

// 未知路径永远被守卫重定向，这个组件不会被渲染。
const NEVER_RENDERED: RouteComponent = { render: () => null }

export function buildRoutes(views: RouteViews): RouteRecordRaw[] {
  return [
    { path: PATHS.login, name: 'login', component: views.login, meta: { access: 'guest' } },
    {
      path: PATHS.home,
      component: views.clientShell,
      meta: { access: 'USER' },
      children: [
        { path: '', name: 'home', component: views.home },
        { path: PATHS.reservation, name: 'reservation', component: views.reservation },
        { path: PATHS.booking, name: 'booking', component: views.booking },
        { path: PATHS.me, name: 'me', component: views.me },
      ],
    },
    { path: `${PATHS.venueAdmin}/:rest(.*)*`, name: 'venue-admin', component: views.venueAdmin, meta: { access: 'VENUE_ADMIN' } },
    { path: `${PATHS.sysAdmin}/:rest(.*)*`, name: 'sys-admin', component: views.sysAdmin, meta: { access: 'SYS_ADMIN' } },
    { path: PATHS.display, name: 'display', component: views.display, meta: { access: 'public' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NEVER_RENDERED, meta: { access: 'fallback' } },
  ]
}
