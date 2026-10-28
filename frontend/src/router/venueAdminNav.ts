// 场馆管理员端的八项导航（P2-1c 增加“扫码签到”）（docs/01 第 4.2 节、ACC-M2-07）。路径只引用 paths.ts（X2）。
import type { UiIconName } from '../utils/icons'
import { PATHS } from './paths'

declare module 'vue-router' {
  interface RouteMeta {
    // P2-1c：该页不需要场馆上下文，外壳不显示场馆选择器（扫码签到，范围由后端按授权裁决）。
    hideVenueSelect?: boolean
  }
}

export interface NavEntry {
  label: string
  path: string
  icon: UiIconName   // UI-2b：侧栏图标
}

export const VENUE_ADMIN_NAV: readonly NavEntry[] = [
  { label: '概览', path: PATHS.venueAdmin, icon: 'dashboard' },
  { label: '预约管理', path: PATHS.venueAdminReservations, icon: 'calendarCheck' },
  { label: '扫码签到', path: PATHS.venueAdminCheckIn, icon: 'scan' },
  { label: '场地与开放规则', path: PATHS.venueAdminResources, icon: 'court' },
  { label: '场地占用总览', path: PATHS.venueAdminOccupancy, icon: 'grid' },
  { label: '公告', path: PATHS.venueAdminAnnouncements, icon: 'megaphone' },
  { label: '报修', path: PATHS.venueAdminRepairs, icon: 'wrench' },
  { label: '操作记录', path: PATHS.venueAdminLogs, icon: 'history' },
]
