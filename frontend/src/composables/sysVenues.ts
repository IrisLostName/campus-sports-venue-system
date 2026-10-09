// 场馆资料与开关页（FE-6 G1）：adminListVenues 列表、新增场馆；编辑资料见 sysVenueEdit，开关与关闭见 sysVenueStatus。
// 新场馆默认 OPEN、不开放预约、无场地无规则（docs/12 第 5.5 节）；创建后引导到“场地与开放规则”设定场地与开放窗口。
import { computed, reactive, ref, shallowRef } from 'vue'

import { api } from '../api/index'
import type { VenueSummary } from '../api/types'
import {
  buildCreateVenueRequest, buildVenueRow, createdNotice, emptyVenueForm, venueFormProblem, type VenueFormFields,
} from '../utils/sysVenueDisplay'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useVenueOptions } from './adminVenue'
import { useSession } from './session'
import { checkedVenueForm, createVenueEditor } from './sysVenueEdit'
import { createVenueStatus } from './sysVenueStatus'

export type { VenueEditState } from './sysVenueEdit'

export interface CreatedVenue {
  id: number
  name: string
}

export function createSysVenues(deps: AdminDeps, reloadContext: () => Promise<void>) {
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const runner = createAdminRunner(deps.call, error)
  const items = shallowRef<VenueSummary[]>([])
  const loaded = ref(false)
  const rows = computed(() => items.value.map(buildVenueRow))
  const form = reactive<VenueFormFields>(emptyVenueForm())
  const formError = ref<string | null>(null)
  const created = ref<CreatedVenue | null>(null)

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminListVenues())
    if (result.ok) {
      items.value = result.value
      loaded.value = true
    }
  }

  // 列表与外壳里的场馆选择器一起刷新。
  const refresh = async (): Promise<void> => { await Promise.all([load(), reloadContext()]) }
  const find = (id: number): VenueSummary | undefined => items.value.find((venue) => venue.id === id)
  const status = createVenueStatus(deps, { find, refresh, error, notice })
  const editor = createVenueEditor(deps, { find, refresh, notify: (text) => { notice.value = text } })

  async function submitCreate(): Promise<void> {
    if (runner.busy.value) {
      return
    }
    notice.value = null
    created.value = null
    formError.value = venueFormProblem(form)
    const fields = formError.value === null ? checkedVenueForm(form) : null
    if (fields === null) {
      return
    }
    const body = buildCreateVenueRequest(fields)
    const result = await runner.run(() => deps.api.adminCreateVenue(body))
    if (result.ok) {
      Object.assign(form, emptyVenueForm())
      created.value = { id: result.value.id, name: result.value.name }
      notice.value = createdNotice(result.value.name)
      await refresh()
    } else if (!result.sessionEnded) {
      formError.value = result.message
    }
  }

  return {
    error, notice, rows, loaded, form, formError, created, creating: runner.busy, load, submitCreate, status,
    edit: editor.state, openEdit: editor.open, patchEdit: editor.patch, confirmEdit: editor.confirm, dismissEdit: editor.dismiss,
  }
}

export function useSysVenues() {
  const { reloadVenues } = useVenueOptions()
  return createSysVenues({ api, call: useSession().caller() }, reloadVenues)
}
