// 系统管理员端的两组导航（docs/01 第 4.3 节、ACC-M2-08、FE-6 S2）。路径只引用 paths.ts（X2）。
// scope 说明页面对场馆上下文的要求（FE-6 S4）：none 不需要场馆；venue 必须选定场馆；venue-or-all 可选“全部场馆”（不带 venueId）。
import { PATHS } from './paths'

export type VenueScope = 'none' | 'venue' | 'venue-or-all'

export const GLOBAL_GROUP = '全局'
export const OPERATION_GROUP = '场馆运营'

export interface SysNavEntry {
  label: string
  path: string
  group: typeof GLOBAL_GROUP | typeof OPERATION_GROUP
  scope: VenueScope
}

export const SYS_ADMIN_NAV: readonly SysNavEntry[] = [
  { label: '场馆资料与开关', path: PATHS.sysAdmin, group: GLOBAL_GROUP, scope: 'none' },
  { label: '管理员与授权', path: PATHS.sysAdminAdmins, group: GLOBAL_GROUP, scope: 'none' },
  { label: '用户', path: PATHS.sysAdminUsers, group: GLOBAL_GROUP, scope: 'none' },
  { label: '系统公告', path: PATHS.sysAdminAnnouncements, group: GLOBAL_GROUP, scope: 'none' },
  { label: '全局统计', path: PATHS.sysAdminStats, group: GLOBAL_GROUP, scope: 'none' },
  { label: '操作记录', path: PATHS.sysAdminLogs, group: GLOBAL_GROUP, scope: 'venue-or-all' },
  { label: '预约管理', path: PATHS.sysAdminReservations, group: OPERATION_GROUP, scope: 'venue-or-all' },
  { label: '场地与开放规则', path: PATHS.sysAdminResources, group: OPERATION_GROUP, scope: 'venue' },
  { label: '场地占用总览', path: PATHS.sysAdminOccupancy, group: OPERATION_GROUP, scope: 'venue' },
  { label: '场馆公告', path: PATHS.sysAdminVenueAnnouncements, group: OPERATION_GROUP, scope: 'venue' },
  { label: '报修', path: PATHS.sysAdminRepairs, group: OPERATION_GROUP, scope: 'venue' },
]

// 路径对应的场馆要求；不在导航里的路径（例如未知子路径）按 none 处理，它们会被路由重定向。
export function scopeOfPath(path: string): VenueScope {
  return SYS_ADMIN_NAV.find((entry) => entry.path === path)?.scope ?? 'none'
}
