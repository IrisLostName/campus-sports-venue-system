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
  venueAdmin: View            // 场馆管理员外壳（AdminShell + 场馆选择），其余 6 个是它的子页面
  venueAdminOverview: View
  venueAdminReservations: View
  venueAdminResources: View
  venueAdminOccupancy: View
  venueAdminAnnouncements: View
  venueAdminRepairs: View
  venueAdminLogs: View
  sysAdmin: View              // 系统管理员外壳（AdminShell + 场馆选择），其余是它的子页面；场馆运营五页复用 venueAdmin* 视图
  sysAdminVenues: View
  sysAdminAdmins: View
  sysAdminUsers: View
  sysAdminAnnouncements: View
  sysAdminStats: View
  display: View
}

// 未知路径永远被守卫或 beforeEnter 重定向，这个组件不会被渲染。
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
    {
      path: PATHS.venueAdmin,
      component: views.venueAdmin,
      meta: { access: 'VENUE_ADMIN' },
      children: [
        { path: '', name: 'venue-admin', component: views.venueAdminOverview },
        { path: PATHS.venueAdminReservations, name: 'venue-admin-reservations', component: views.venueAdminReservations },
        { path: PATHS.venueAdminResources, name: 'venue-admin-resources', component: views.venueAdminResources },
        { path: PATHS.venueAdminOccupancy, name: 'venue-admin-occupancy', component: views.venueAdminOccupancy },
        { path: PATHS.venueAdminAnnouncements, name: 'venue-admin-announcements', component: views.venueAdminAnnouncements },
        { path: PATHS.venueAdminRepairs, name: 'venue-admin-repairs', component: views.venueAdminRepairs },
        { path: PATHS.venueAdminLogs, name: 'venue-admin-logs', component: views.venueAdminLogs },
        // 未知子路径回到概览，并保留查询参数（场馆选择）。
        // beforeEnter 在全局守卫之后运行：未登录者仍会带着原路径被送去登录，登录后的管理员才被带回概览。
        { path: ':pathMatch(.*)*', component: NEVER_RENDERED, beforeEnter: (to) => ({ path: PATHS.venueAdmin, query: to.query }) },
      ],
    },
    {
      path: PATHS.sysAdmin,
      component: views.sysAdmin,
      meta: { access: 'SYS_ADMIN' },
      children: [
        { path: '', name: 'sys-admin', component: views.sysAdminVenues },
        { path: PATHS.sysAdminAdmins, name: 'sys-admin-admins', component: views.sysAdminAdmins },
        { path: PATHS.sysAdminUsers, name: 'sys-admin-users', component: views.sysAdminUsers },
        { path: PATHS.sysAdminAnnouncements, name: 'sys-admin-announcements', component: views.sysAdminAnnouncements },
        { path: PATHS.sysAdminStats, name: 'sys-admin-stats', component: views.sysAdminStats },
        { path: PATHS.sysAdminLogs, name: 'sys-admin-logs', component: views.venueAdminLogs },
        // 场馆运营五页直接复用场馆管理员端的页面组件（FE-6 S2），场馆上下文由系统管理员外壳提供。
        { path: PATHS.sysAdminReservations, name: 'sys-admin-reservations', component: views.venueAdminReservations },
        { path: PATHS.sysAdminResources, name: 'sys-admin-resources', component: views.venueAdminResources },
        { path: PATHS.sysAdminOccupancy, name: 'sys-admin-occupancy', component: views.venueAdminOccupancy },
        { path: PATHS.sysAdminVenueAnnouncements, name: 'sys-admin-venue-announcements', component: views.venueAdminAnnouncements },
        { path: PATHS.sysAdminRepairs, name: 'sys-admin-repairs', component: views.venueAdminRepairs },
        // 同 FE-5：未知子路径回到 /sys-admin，保留查询参数；beforeEnter 在全局守卫之后运行。
        { path: ':pathMatch(.*)*', component: NEVER_RENDERED, beforeEnter: (to) => ({ path: PATHS.sysAdmin, query: to.query }) },
      ],
    },
    { path: PATHS.display, name: 'display', component: views.display, meta: { access: 'public' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NEVER_RENDERED, meta: { access: 'fallback' } },
  ]
}
