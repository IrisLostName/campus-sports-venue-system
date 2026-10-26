// 路由表（docs/02 第 3.1 节）。视图由调用方传入：应用传懒加载组件，测试传替身组件。
// meta.title 是页面名（UI-2b）：标签页标题与管理端顶栏都取它（titles.ts）；管理端的页面名与侧栏导航项文字相同。
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
    { path: PATHS.login, name: 'login', component: views.login, meta: { access: 'guest', title: '登录' } },
    {
      path: PATHS.home,
      component: views.clientShell,
      meta: { access: 'USER' },
      children: [
        { path: '', name: 'home', component: views.home, meta: { title: '首页' } },
        { path: PATHS.reservation, name: 'reservation', component: views.reservation, meta: { title: '预约' } },
        { path: PATHS.booking, name: 'booking', component: views.booking, meta: { title: '订场' } },
        { path: PATHS.me, name: 'me', component: views.me, meta: { title: '我的' } },
      ],
    },
    {
      path: PATHS.venueAdmin,
      component: views.venueAdmin,
      meta: { access: 'VENUE_ADMIN' },
      children: [
        { path: '', name: 'venue-admin', component: views.venueAdminOverview, meta: { title: '概览' } },
        { path: PATHS.venueAdminReservations, name: 'venue-admin-reservations', component: views.venueAdminReservations, meta: { title: '预约管理' } },
        { path: PATHS.venueAdminResources, name: 'venue-admin-resources', component: views.venueAdminResources, meta: { title: '场地与开放规则' } },
        { path: PATHS.venueAdminOccupancy, name: 'venue-admin-occupancy', component: views.venueAdminOccupancy, meta: { title: '场地占用总览' } },
        { path: PATHS.venueAdminAnnouncements, name: 'venue-admin-announcements', component: views.venueAdminAnnouncements, meta: { title: '公告' } },
        { path: PATHS.venueAdminRepairs, name: 'venue-admin-repairs', component: views.venueAdminRepairs, meta: { title: '报修' } },
        { path: PATHS.venueAdminLogs, name: 'venue-admin-logs', component: views.venueAdminLogs, meta: { title: '操作记录' } },
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
        // meta.venueScope 是各页面对场馆上下文的要求（FE-6 S4），外壳从匹配到的路由记录读取，不按地址字符串判断。
        { path: '', name: 'sys-admin', component: views.sysAdminVenues, meta: { venueScope: 'none', title: '场馆资料与开关' } },
        { path: PATHS.sysAdminAdmins, name: 'sys-admin-admins', component: views.sysAdminAdmins, meta: { venueScope: 'none', title: '管理员与授权' } },
        { path: PATHS.sysAdminUsers, name: 'sys-admin-users', component: views.sysAdminUsers, meta: { venueScope: 'none', title: '用户' } },
        { path: PATHS.sysAdminAnnouncements, name: 'sys-admin-announcements', component: views.sysAdminAnnouncements, meta: { venueScope: 'none', title: '系统公告' } },
        { path: PATHS.sysAdminStats, name: 'sys-admin-stats', component: views.sysAdminStats, meta: { venueScope: 'none', title: '全局统计' } },
        { path: PATHS.sysAdminLogs, name: 'sys-admin-logs', component: views.venueAdminLogs, meta: { venueScope: 'venue-or-all', title: '操作记录' } },
        // 场馆运营五页直接复用场馆管理员端的页面组件（FE-6 S2），场馆上下文由系统管理员外壳提供。
        { path: PATHS.sysAdminReservations, name: 'sys-admin-reservations', component: views.venueAdminReservations, meta: { venueScope: 'venue-or-all', title: '预约管理' } },
        { path: PATHS.sysAdminResources, name: 'sys-admin-resources', component: views.venueAdminResources, meta: { venueScope: 'venue', title: '场地与开放规则' } },
        { path: PATHS.sysAdminOccupancy, name: 'sys-admin-occupancy', component: views.venueAdminOccupancy, meta: { venueScope: 'venue', title: '场地占用总览' } },
        { path: PATHS.sysAdminVenueAnnouncements, name: 'sys-admin-venue-announcements', component: views.venueAdminAnnouncements, meta: { venueScope: 'venue', title: '场馆公告' } },
        { path: PATHS.sysAdminRepairs, name: 'sys-admin-repairs', component: views.venueAdminRepairs, meta: { venueScope: 'venue', title: '报修' } },
        // 同 FE-5：未知子路径回到 /sys-admin，保留查询参数；beforeEnter 在全局守卫之后运行。
        { path: ':pathMatch(.*)*', component: NEVER_RENDERED, beforeEnter: (to) => ({ path: PATHS.sysAdmin, query: to.query }) },
      ],
    },
    { path: PATHS.display, name: 'display', component: views.display, meta: { access: 'public', title: '运营大屏' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NEVER_RENDERED, meta: { access: 'fallback' } },
  ]
}
