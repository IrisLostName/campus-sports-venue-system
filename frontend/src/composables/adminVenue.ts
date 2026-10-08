// 场馆管理员端的“当前场馆”上下文（FE-5 S3）：选项来自 adminListVenues()，所选场馆写在查询参数 venueId。
// 外壳创建并 provide，各页面 inject；页面只在场馆已确定后才会被渲染（外壳用 venueId 作 key）。
import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { VenueSummary } from '../api/types'
import { parseVenueId, resolveVenueId } from '../utils/venueSelection'
import { useSession, type ApiCaller } from './session'

export interface VenueContextDeps {
  api: ApiClient
  call: ApiCaller
  rawVenueId: () => unknown                    // 当前查询参数里的 venueId
  writeVenueId: (venueId: number) => Promise<void>
}

export function createAdminVenueContext(deps: VenueContextDeps) {
  const venues = ref<VenueSummary[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const venueId = computed(() => resolveVenueId(deps.rawVenueId(), venues.value))
  const venue = computed(() => venues.value.find((item) => item.id === venueId.value) ?? null)

  // 查询参数缺省或无效时，把解析出的场馆写回地址栏，刷新后保持。
  async function normalize(): Promise<void> {
    const resolved = venueId.value
    if (resolved !== null && parseVenueId(deps.rawVenueId()) !== resolved) {
      await deps.writeVenueId(resolved)
    }
  }

  async function load(): Promise<void> {
    const result = await deps.call(() => deps.api.adminListVenues())
    if (result.ok) {
      venues.value = result.value
      error.value = null
      loaded.value = true
      await normalize()
    } else if (!result.sessionEnded) {
      error.value = result.message
    }
  }

  async function select(id: number): Promise<void> {
    if (venues.value.some((item) => item.id === id)) {
      await deps.writeVenueId(id)
    }
  }

  return { venues, loaded, error, venueId, venue, load, select, normalize }
}

export type AdminVenueContext = ReturnType<typeof createAdminVenueContext>

const CONTEXT_KEY: InjectionKey<AdminVenueContext> = Symbol('adminVenueContext')

// 外壳在 setup 里调用：创建上下文并提供给子页面。
export function useAdminVenueContext(): AdminVenueContext {
  const route = useRoute()
  const router = useRouter()
  const context = createAdminVenueContext({
    api,
    call: useSession().caller(),
    rawVenueId: () => route.query.venueId,
    writeVenueId: async (id) => {
      await router.replace({ query: { ...route.query, venueId: String(id) } })
    },
  })
  provide(CONTEXT_KEY, context)
  return context
}

// 页面在 setup 里调用：venueId 在该页面实例的整个生命周期内不变（外壳按 venueId 作 key 重建页面）。
export function useCurrentVenue() {
  const context = inject(CONTEXT_KEY)
  const venueId = context?.venueId.value
  if (context === undefined || venueId === null || venueId === undefined) {
    throw new Error('页面必须在已确定场馆的场馆管理员外壳内使用')
  }
  return { venueId, venue: context.venue, reloadVenues: context.load }
}
