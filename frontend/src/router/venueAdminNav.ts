// 场馆管理员端的七项导航（docs/01 第 4.2 节、ACC-M2-07）。路径只引用 paths.ts（X2）。
import type { UiIconName } from '../utils/icons'
import { PATHS } from './paths'

export interface NavEntry {
  label: string
  path: string
  icon: UiIconName   // UI-2b：侧栏图标
}

export const VENUE_ADMIN_NAV: readonly NavEntry[] = [
  { label: '概览', path: PATHS.venueAdmin, icon: 'dashboard' },
  { label: '预约管理', path: PATHS.venueAdminReservations, icon: 'calendarCheck' },
  { label: '场地与开放规则', path: PATHS.venueAdminResources, icon: 'court' },
  { label: '场地占用总览', path: PATHS.venueAdminOccupancy, icon: 'grid' },
  { label: '公告', path: PATHS.venueAdminAnnouncements, icon: 'megaphone' },
  { label: '报修', path: PATHS.venueAdminRepairs, icon: 'wrench' },
  { label: '操作记录', path: PATHS.venueAdminLogs, icon: 'history' },
]
