// 订场页的“浏览”部分（FE-4 B1–B6）：场馆列表 → 日期 → 各场地时段，以及所选场馆的公告。
// 场馆列表每次进入页面都重新拉取，不缓存到 store（B3）。所有调用都经 ApiCaller（X1）。
import { computed, ref, type Ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { Announcement, VenueSlots, VenueSummary } from '../api/types'
import { dateOptions, type DateOption } from '../utils/bookingDisplay'
import { buildAnnouncement } from '../utils/reservationDisplay'
import type { ReferenceStore } from '../stores/reference'
import type { ListPhase } from './reservationList'
import { createPinnedNotices } from './bookingPinned'
import type { ApiCaller } from './session'

export interface BrowseDeps {
  api: ApiClient
  call: ApiCaller
  reference: ReferenceStore
  today: () => string          // 场馆本地今天 YYYY-MM-DD；测试注入固定值
}

type Caller = Pick<BrowseDeps, 'api' | 'call'>

// 场馆列表（B3：每次进入页面拉取，不缓存）与 BookingRules。
function createVenueCatalog(deps: BrowseDeps) {
  const venues = ref<VenueSummary[]>([])
  const phase = ref<ListPhase>('idle')
  const error = ref<string | null>(null)
  const rulesError = ref<string | null>(null)

  async function fetchVenues(): Promise<void> {
    const result = await deps.call(() => deps.api.listVenues())
    if (result.ok) {
      venues.value = result.value
      error.value = null
      phase.value = 'ready'
    } else if (!result.sessionEnded) {
      error.value = result.message
      phase.value = venues.value.length > 0 ? 'ready' : 'failed'
    }
  }

  async function fetchRules(): Promise<boolean> {
    const result = await deps.reference.loadBookingRules(deps.call)
    rulesError.value = result.ok || result.sessionEnded ? null : result.message
    return result.ok
  }

  async function load(): Promise<void> {
    phase.value = 'loading'
    await Promise.all([fetchVenues(), fetchRules()])
  }

  return { venues, phase, error, rulesError, fetchRules, load }
}

// 所选场馆、所选日期的各场地时段。快速切换时，较早发出的请求后到达不能覆盖较新的结果。
function createSlotLoader(deps: Caller, venueId: Ref<number | null>, date: Ref<string | null>) {
  const slots = ref<VenueSlots | null>(null)
  const phase = ref<ListPhase>('idle')
  const error = ref<string | null>(null)
  let latest = 0

  async function load(): Promise<void> {
    const targetVenue = venueId.value
    const targetDate = date.value
    if (targetVenue === null || targetDate === null) {
      return
    }
    latest += 1
    const mine = latest
    phase.value = 'loading'
    const result = await deps.call(() => deps.api.getVenueSlots(targetVenue, targetDate))
    if (mine !== latest) {
      return
    }
    if (result.ok) {
      slots.value = result.value
      error.value = null
      phase.value = 'ready'
    } else if (!result.sessionEnded) {
      slots.value = null
      error.value = result.message
      phase.value = 'failed'
    }
  }

  function reset(): void {
    latest += 1
    slots.value = null
    phase.value = 'idle'
    error.value = null
  }

  return { slots, phase, error, load, reset }
}

// B6：场馆公告只显示所选场馆的。
function createVenueNotices(deps: Caller) {
  const items = ref<Announcement[]>([])
  const error = ref<string | null>(null)
  let latest = 0

  async function load(venueId: number): Promise<void> {
    latest += 1
    const mine = latest
    const result = await deps.call(() => deps.api.listAnnouncements({ scope: 'VENUE', venueId }))
    if (mine !== latest) {
      return
    }
    if (result.ok) {
      items.value = result.value
      error.value = null
    } else if (!result.sessionEnded) {
      items.value = []
      error.value = result.message
    }
  }

  function reset(): void {
    latest += 1
    items.value = []
    error.value = null
  }

  return { items: computed(() => items.value.map(buildAnnouncement)), error, load, reset }
}

export function createBookingBrowse(deps: BrowseDeps) {
  const catalog = createVenueCatalog(deps)
  const venueId = ref<number | null>(null)
  const dates = ref<DateOption[]>([])
  const date = ref<string | null>(null)
  const slotLoader = createSlotLoader(deps, venueId, date)
  const notices = createVenueNotices(deps)
  const pinned = createPinnedNotices(deps)

  // 进入页面：拉取场馆列表与 BookingRules，再按场馆列表取各场馆的置顶公告（UI-3）。
  async function load(): Promise<void> {
    await catalog.load()
    await pinned.load(catalog.venues.value.map((item) => item.id))
  }

  const venue =computed(() => catalog.venues.value.find((item) => item.id === venueId.value) ?? null)

  function clearVenue(): void {
    venueId.value = null
    dates.value = []
    date.value = null
    slotLoader.reset()
    notices.reset()
  }

  // 日期选项为 [今天, 今天 + advanceDays)（B4），规则没取到就没有选项、不写死天数；UI-3 起不默认选中（UI-3 裁决第 4 节第 2 条）。
  function applyDates(ready: boolean): void {
    const advanceDays = deps.reference.bookingRules?.advanceDays ?? 0
    dates.value = ready ? dateOptions(deps.today(), advanceDays) : []
    date.value = null
  }

  // B2：bookable=false 的场馆不能进入。可选日期需要 BookingRules.advanceDays；之前取失败则这里再取一次。
  async function selectVenue(id: number): Promise<void> {
    const target = catalog.venues.value.find((item) => item.id === id)
    if (target === undefined || !target.bookable) {
      return
    }
    clearVenue()
    venueId.value = id
    applyDates(deps.reference.bookingRules !== null || await catalog.fetchRules())
    await notices.load(id)
  }

  // FE-8 L4：已选场馆但 BookingRules 没取到时，就地重试；成功后补出日期（仍待用户选定）。期间换了场馆则放弃。
  async function retryRules(): Promise<void> {
    const id = venueId.value
    if (id === null) {
      return
    }
    const ready = await catalog.fetchRules()
    if (venueId.value !== id) {
      return
    }
    applyDates(ready)
  }

  // UI-3：从时段层返回月历层，清掉所选日期与时段。
  function clearDate(): void {
    date.value = null
    slotLoader.reset()
  }

  // 越出选项的日期不接受；越界仍以后端 DATE_OUT_OF_RANGE 为准（B4）。
  async function selectDate(value: string): Promise<void> {
    if (!dates.value.some((option) => option.value === value)) {
      return
    }
    date.value = value
    await slotLoader.load()
  }

  return {
    venues: catalog.venues, venuesPhase: catalog.phase, venuesError: catalog.error, rulesError: catalog.rulesError,
    venueId, venue, dates, date,
    slots: slotLoader.slots, slotsPhase: slotLoader.phase, slotsError: slotLoader.error,
    announcementItems: notices.items, announcementError: notices.error,
    pinned: pinned.items, load, selectVenue, retryRules, selectDate, loadSlots: slotLoader.load, clearVenue, clearDate,
  }
}

export type BookingBrowse = ReturnType<typeof createBookingBrowse>
