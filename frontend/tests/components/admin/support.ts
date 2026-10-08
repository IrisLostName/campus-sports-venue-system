// FE-5 组件测试脚手架：真实路由表 + 真实页面 + mock ApiClient（注入时钟），挂载一个只含 RouterView 的根组件。
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h as render } from 'vue'
import { createMemoryHistory, RouterView, type Router } from 'vue-router'

import type { ApiClient } from '../../../src/api/client'
import { createAppRouter } from '../../../src/router/factory'
import type { RouteViews } from '../../../src/router/routes'
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

export const ADMIN_VIEWS: RouteViews = {
  ...STUB_VIEWS,
  venueAdmin: VenueAdminShell,
  venueAdminOverview: OverviewView,
  venueAdminReservations: ReservationsView,
  venueAdminResources: ResourcesView,
  venueAdminOccupancy: OccupancyView,
  venueAdminAnnouncements: AnnouncementsView,
  venueAdminRepairs: RepairsView,
  venueAdminLogs: LogsView,
}

const Root = defineComponent({ render: () => render(RouterView) })

export interface AdminApp {
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

export async function openAdminApp(path: string, options: OpenOptions = {}): Promise<AdminApp> {
  const h = createAuthHarness()
  const login = await h.auth.login({ username: options.username ?? 'admin_tennis', password: DEMO_PASSWORD })
  if (!login.ok) {
    throw new Error(`登录失败：${login.code}`)
  }
  await options.prepare?.(h)
  useApiClient(options.wrap === undefined ? h.api : options.wrap(h.api))
  const router = createAppRouter({ history: createMemoryHistory(), views: ADMIN_VIEWS, getAuth: () => h.auth })
  await router.push(path)
  const root = mount(Root, { global: { plugins: [h.auth._p, router] } })
  await flushPromises()
  return { h, router, root }
}

// 页面内容区（外壳的 main），不含侧栏与顶栏。
export function content(root: VueWrapper) {
  return root.get('main')
}

// 在 wrapper（整页或某个区域）里找文字完全等于 text 的按钮；找不到时抛错，测试不会静默通过。
export function buttonIn(wrapper: Pick<DOMWrapper<Element>, 'findAll'>, text: string): DOMWrapper<HTMLButtonElement> {
  const found = wrapper.findAll('button').find((node) => node.text() === text)
  if (found === undefined) {
    throw new Error(`找不到按钮“${text}”，现有按钮：${wrapper.findAll('button').map((node) => node.text()).join('、')}`)
  }
  return found
}
