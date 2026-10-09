// 系统管理员端的两组导航（docs/01 第 4.3 节、ACC-M2-08、FE-6 S2）。路径只引用 paths.ts（X2）。
// 页面对场馆上下文的要求（FE-6 S4）写在路由记录的 meta.venueScope 里（routes.ts），从匹配到的路由记录读取：
// none 不需要场馆；venue 必须选定场馆；venue-or-all 可选“全部场馆”（不带 venueId）。
// 不按地址字符串判断：vue-router 对大小写与尾部斜杠不敏感，等价地址必须得到同样的要求。
import type { RouteLocationNormalized } from 'vue-router'

import { PATHS } from './paths'

export type VenueScope = 'none' | 'venue' | 'venue-or-all'

declare module 'vue-router' {
  interface RouteMeta {
    venueScope?: VenueScope
  }
}

export const GLOBAL_GROUP = '全局'
export const OPERATION_GROUP = '场馆运营'

export interface SysNavEntry {
  label: string
  path: string
  group: typeof GLOBAL_GROUP | typeof OPERATION_GROUP
}

export const SYS_ADMIN_NAV: readonly SysNavEntry[] = [
  { label: '场馆资料与开关', path: PATHS.sysAdmin, group: GLOBAL_GROUP },
  { label: '管理员与授权', path: PATHS.sysAdminAdmins, group: GLOBAL_GROUP },
  { label: '用户', path: PATHS.sysAdminUsers, group: GLOBAL_GROUP },
  { label: '系统公告', path: PATHS.sysAdminAnnouncements, group: GLOBAL_GROUP },
  { label: '全局统计', path: PATHS.sysAdminStats, group: GLOBAL_GROUP },
  { label: '操作记录', path: PATHS.sysAdminLogs, group: GLOBAL_GROUP },
  { label: '预约管理', path: PATHS.sysAdminReservations, group: OPERATION_GROUP },
  { label: '场地与开放规则', path: PATHS.sysAdminResources, group: OPERATION_GROUP },
  { label: '场地占用总览', path: PATHS.sysAdminOccupancy, group: OPERATION_GROUP },
  { label: '场馆公告', path: PATHS.sysAdminVenueAnnouncements, group: OPERATION_GROUP },
  { label: '报修', path: PATHS.sysAdminRepairs, group: OPERATION_GROUP },
]

// 匹配到的最内层路由记录所声明的场馆要求；没有声明的记录（例如未知子路径，它们会被路由重定向）按 none 处理。
export function scopeOfRoute(location: Pick<RouteLocationNormalized, 'matched'>): VenueScope {
  return location.matched.at(-1)?.meta.venueScope ?? 'none'
}
