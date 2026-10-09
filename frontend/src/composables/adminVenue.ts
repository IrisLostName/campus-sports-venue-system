// 管理端的“当前场馆”上下文（FE-5 S3；FE-6 S4 扩展）：选项来自 adminListVenues()，所选场馆写在查询参数 venueId。
// 外壳创建并 provide，各页面 inject。场馆管理员端的页面只在场馆已确定后才会被渲染（外壳用 venueId 作 key）；
// 系统管理员端的“全部场馆”页面（预约管理、操作记录）允许 venueId 为 null（查询参数缺省）。
import { computed, inject, provide, ref, watch, type InjectionKey } from 'vue'
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
  allowAll?: () => boolean                     // 当前页面是否允许“全部场馆”（不选场馆）；缺省 false
  clearVenueId?: () => Promise<void>           // 选择“全部场馆”时移除查询参数
}

export function createAdminVenueContext(deps: VenueContextDeps) {
  const venues = ref<VenueSummary[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const allowAll = (): boolean => deps.allowAll?.() ?? false
  const venueId = computed(() => resolveVenueId(deps.rawVenueId(), venues.value, allowAll()))
  const venue = computed(() => venues.value.find((item) => item.id === venueId.value) ?? null)

  // 查询参数缺省或无效时，把解析出的场馆写回地址栏，刷新后保持。“全部场馆”页面不写回。
  async function normalize(): Promise<void> {
    const resolved = venueId.value
    if (resolved !== null && parseVenueId(deps.rawVenueId()) !== resolved) {
      await deps.writeVenueId(resolved)
    }
  }

  // FE-5 N4：查询参数（或页面对“全部场馆”的要求）在加载之后变化时也要规范化，不只首次加载。
  watch([() => deps.rawVenueId(), allowAll], () => {
    if (loaded.value) {
      void normalize()
    }
  })

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

  // null = 全部场馆（仅在页面允许时有效）。
  async function select(id: number | null): Promise<void> {
    if (id === null) {
      if (allowAll()) {
        await deps.clearVenueId?.()
      }
    } else if (venues.value.some((item) => item.id === id)) {
      await deps.writeVenueId(id)
    }
  }

  return { venues, loaded, error, venueId, venue, load, select, normalize }
}

export type AdminVenueContext = ReturnType<typeof createAdminVenueContext>

const CONTEXT_KEY: InjectionKey<AdminVenueContext> = Symbol('adminVenueContext')

export interface VenueContextOptions {
  allowAll?: () => boolean
}

// 外壳在 setup 里调用：创建上下文并提供给子页面。
export function useAdminVenueContext(options: VenueContextOptions = {}): AdminVenueContext {
  const route = useRoute()
  const router = useRouter()
  const context = createAdminVenueContext({
    api,
    call: useSession().caller(),
    rawVenueId: () => route.query.venueId,
    writeVenueId: async (id) => {
      await router.replace({ query: { ...route.query, venueId: String(id) } })
    },
    clearVenueId: async () => {
      const query = { ...route.query }
      delete query.venueId
      await router.replace({ query })
    },
    ...(options.allowAll === undefined ? {} : { allowAll: options.allowAll }),
  })
  provide(CONTEXT_KEY, context)
  return context
}

function injectContext(): AdminVenueContext {
  const context = inject(CONTEXT_KEY)
  if (context === undefined) {
    throw new Error('页面必须在管理端外壳内使用')
  }
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

// 允许“全部场馆”的页面（FE-6 G6、G7）：venueId 为 undefined 表示不限定场馆。
export function useOptionalVenue() {
  const context = injectContext()
  return { venueId: context.venueId.value ?? undefined, venues: context.venues }
}

// 不要求选定场馆的全局页面（FE-6 G1、G2）：读取场馆列表，并在改动后刷新外壳里的列表。
export function useVenueOptions() {
  const context = injectContext()
  return { venues: context.venues, reloadVenues: context.load }
}
