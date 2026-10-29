// “订场”页的全部逻辑（FE-4 B1–B9，ACC-M2-04；UI-3 增加月历步骤 dates）：浏览（场馆 → 日期 → 时段）由 bookingBrowse 负责，
// 这里负责选中时段、确认步骤（P2-2c 起含同行人名单，见 bookingCompanions）、提交与结果。页面只渲染；步骤由数据决定，不靠模板碰巧。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { Reservation } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { useReferenceStore, type ReferenceStore } from '../stores/reference'
import { buildSlotGroups, isPickStillOpen, isSelectable } from '../utils/bookingDisplay'
import { COMPANION_TEXTS, companionNames } from '../utils/companionDisplay'
import { buildSummary, formatServiceDate } from '../utils/reservationDisplay'
import { todayShanghai } from '../utils/shanghaiTime'
import { createBookingBrowse, type BookingBrowse } from './bookingBrowse'
import { createBookingCompanions, type BookingCompanions, type SelfIdentity } from './bookingCompanions'
import { useSession, type ApiCaller } from './session'

export interface BookingDeps {
  api: ApiClient
  call: ApiCaller
  reference: ReferenceStore
  today: () => string
  self?: () => SelfIdentity | null   // P2-2c：当前用户，用于“不能添加自己”的提示
}

export type BookingStep = 'venues' | 'dates' | 'slots' | 'confirm' | 'done'

export interface SlotSelection {
  resourceId: number
  resourceName: string
  startTime: string
  endTime: string
}

// 选中某个时段（B5：只有接口标成 AVAILABLE 的可选），以及重新拉取之后的核对。
function createSelection(browse: BookingBrowse) {
  const selection = ref<SlotSelection | null>(null)

  function select(resourceId: number, startTime: string): boolean {
    const resource = browse.slots.value?.resources.find((item) => item.resourceId === resourceId)
    const slot = resource?.slots.find((item) => item.startTime === startTime)
    if (resource === undefined || slot === undefined || !isSelectable(slot.status)) {
      return false
    }
    selection.value = { resourceId, resourceName: resource.resourceName, startTime, endTime: slot.endTime }
    return true
  }

  // 重新拉取时段后，所选时段若不再是 AVAILABLE（例如刚被别人订走），就退出确认步骤。
  async function reloadSlots(): Promise<void> {
    await browse.loadSlots()
    const picked = selection.value
    if (picked !== null && !isPickStillOpen(browse.slots.value?.resources ?? [], picked)) {
      selection.value = null
    }
  }

  const groups = computed(() => buildSlotGroups(browse.slots.value?.resources ?? [], selection.value))

  const confirmation = computed(() => {
    const picked = selection.value
    const venue = browse.venue.value
    const date = browse.date.value
    if (picked === null || venue === null || date === null) {
      return null
    }
    return {
      venueName: venue.name,
      resourceName: picked.resourceName,
      dateText: formatServiceDate(date),
      timeText: `${picked.startTime}–${picked.endTime}`,
    }
  })

  return { selection, select, reloadSlots, groups, confirmation }
}

type Selection = ReturnType<typeof createSelection>

// B7/B8：提交进行中不可重复触发；失败显示错误码文案并重新拉取当前日期的时段。
// P2-2c：有同行人时按添加顺序发送 companionUserIds，没有时不发送该字段；失败时名单保留，成功后清空。
function createSubmission(deps: BookingDeps, browse: BookingBrowse, picked: Selection, companions: BookingCompanions) {
  const purpose = ref('')
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const created = ref<Reservation | null>(null)

  const result = computed(() => (created.value === null ? null : buildSummary(created.value)))
  const resultCompanions = computed(() => (created.value === null ? null : companionNames(created.value.companions)))

  async function submit(): Promise<void> {
    const choice = picked.selection.value
    const date = browse.date.value
    if (choice === null || date === null || submitting.value) {
      return
    }
    submitting.value = true
    error.value = null
    const text = purpose.value.trim()
    const companionUserIds = companions.ids()
    const outcome = await deps.call(() => deps.api.createReservation({
      resourceId: choice.resourceId, serviceDate: date, startTime: choice.startTime,
      ...(text === '' ? {} : { purpose: text }),
      ...(companionUserIds.length === 0 ? {} : { companionUserIds }),
    }))
    if (outcome.ok) {
      created.value = outcome.value
      picked.selection.value = null
      companions.clear()
    } else if (!outcome.sessionEnded) {
      // 同行人校验失败（fields.companionUserIds）：只看字段名，不显示后端说明文字（P2-2c 裁决第 5 节第 4 条）。
      const companionsInvalid = outcome.code === 'VALIDATION_ERROR' && (outcome.fieldKeys ?? []).includes('companionUserIds')
      error.value = companionsInvalid ? COMPANION_TEXTS.submitInvalid : outcome.message
      await picked.reloadSlots()
    }
    submitting.value = false
  }

  function reset(): void {
    created.value = null
    purpose.value = ''
    error.value = null
  }

  return { purpose, submitting, error, created, result, resultCompanions, submit, reset }
}

export function createBookingBoard(deps: BookingDeps) {
  const browse = createBookingBrowse(deps)
  const picked = createSelection(browse)
  const companions = createBookingCompanions(deps)
  const submission = createSubmission(deps, browse, picked, companions)

  // 步骤由数据决定。
  const step = computed<BookingStep>(() => {
    if (submission.created.value !== null) {
      return 'done'
    }
    if (picked.selection.value !== null) {
      return 'confirm'
    }
    if (browse.venueId.value === null) {
      return 'venues'
    }
    return browse.date.value === null ? 'dates' : 'slots'
  })

  async function selectVenue(id: number): Promise<void> {
    backToSlots()
    await browse.selectVenue(id)
  }

  async function selectDate(value: string): Promise<void> {
    backToSlots()
    await browse.selectDate(value)
  }

  function selectSlot(resourceId: number, startTime: string): void {
    if (picked.select(resourceId, startTime)) {
      submission.reset()
    }
  }

  function backToSlots(): void {
    picked.selection.value = null
    submission.error.value = null
  }

  // UI-3：从时段层逐层返回月历层。
  function backToDates(): void {
    backToSlots()
    browse.clearDate()
  }

  function backToVenues(): void {
    backToSlots()
    browse.clearVenue()
  }

  // 成功页上的“继续订场”：回到场馆列表，重新拉取。
  async function restart(): Promise<void> {
    submission.reset()
    companions.clear()
    backToVenues()
    await browse.load()
  }

  return {
    ...browse, step, groups: picked.groups, selection: picked.selection, confirmation: picked.confirmation,
    purpose: submission.purpose, submitting: submission.submitting, submitError: submission.error,
    result: submission.result, resultCompanions: submission.resultCompanions, submit: submission.submit, companions,
    selectVenue, selectDate, selectSlot, backToSlots, backToDates, backToVenues, restart,
  }
}

export type BookingBoard = ReturnType<typeof createBookingBoard>

export function useBookingBoard(): BookingBoard {
  const auth = useAuthStore()
  return createBookingBoard({
    api, call: useSession().caller(), reference: useReferenceStore(), today: todayShanghai, self: () => auth.user,
  })
}
