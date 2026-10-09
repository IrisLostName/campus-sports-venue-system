// FE-6 组件测试脚手架：真实路由表 + 真实页面（系统管理员外壳与 FE-5 复用的页面）+ mock ApiClient（注入时钟）。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h as render } from 'vue'
import { createMemoryHistory, RouterView, type Router } from 'vue-router'

import type { ApiClient } from '../../../src/api/client'
import { createAppRouter } from '../../../src/router/factory'
import type { RouteViews } from '../../../src/router/routes'
import SysAdminShell from '../../../src/views/sys-admin/SysAdminShell.vue'
import SysAdminsView from '../../../src/views/sys-admin/SysAdminsView.vue'
import SysAnnouncementsView from '../../../src/views/sys-admin/SysAnnouncementsView.vue'
import SysStatsView from '../../../src/views/sys-admin/SysStatsView.vue'
import SysUsersView from '../../../src/views/sys-admin/SysUsersView.vue'
import SysVenuesView from '../../../src/views/sys-admin/SysVenuesView.vue'
import AnnouncementsView from '../../../src/views/venue-admin/AnnouncementsView.vue'
import LogsView from '../../../src/views/venue-admin/LogsView.vue'
import OccupancyView from '../../../src/views/venue-admin/OccupancyView.vue'
import OverviewView from '../../../src/views/venue-admin/OverviewView.vue'
import RepairsView from '../../../src/views/venue-admin/RepairsView.vue'
import ReservationsView from '../../../src/views/venue-admin/ReservationsView.vue'
import ResourcesView from '../../../src/views/venue-admin/ResourcesView.vue'
import VenueAdminShell from '../../../src/views/venue-admin/VenueAdminShell.vue'
import { createAuthHarness, DEMO_PASSWORD, STUB_VIEWS, type AuthHarness } from '../../auth/harness'
import { useApiClient } from '../apiSwap'

export { buttonIn, content, fieldByLabel } from '../admin/support'

export const SYS_VIEWS: RouteViews = {
  ...STUB_VIEWS,
  venueAdmin: VenueAdminShell,
  venueAdminOverview: OverviewView,
  venueAdminReservations: ReservationsView,
  venueAdminResources: ResourcesView,
  venueAdminOccupancy: OccupancyView,
  venueAdminAnnouncements: AnnouncementsView,
  venueAdminRepairs: RepairsView,
  venueAdminLogs: LogsView,
  sysAdmin: SysAdminShell,
  sysAdminVenues: SysVenuesView,
  sysAdminAdmins: SysAdminsView,
  sysAdminUsers: SysUsersView,
  sysAdminAnnouncements: SysAnnouncementsView,
  sysAdminStats: SysStatsView,
}

const Root = defineComponent({ render: () => render(RouterView) })

export interface SysApp {
  h: AuthHarness
  router: Router
  root: VueWrapper
}

export interface OpenOptions {
  username?: string
  // 页面看到的 api 可以被包装（统计调用、制造失败）。
  wrap?: (api: ApiClient) => ApiClient
  // 进入页面之前先准备数据（使用 h.clientFor 等）。
  prepare?: (h: AuthHarness) => Promise<void>
}

export async function openSysApp(path: string, options: OpenOptions = {}): Promise<SysApp> {
  const h = createAuthHarness()
  const login = await h.auth.login({ username: options.username ?? 'sysadmin', password: DEMO_PASSWORD })
  if (!login.ok) {
    throw new Error(`登录失败：${login.code}`)
  }
  await options.prepare?.(h)
  useApiClient(options.wrap === undefined ? h.api : options.wrap(h.api))
  const router = createAppRouter({ history: createMemoryHistory(), views: SYS_VIEWS, getAuth: () => h.auth })
  await router.push(path)
  const root = mount(Root, { global: { plugins: [h.auth._p, router] } })
  await flushPromises()
  return { h, router, root }
}
