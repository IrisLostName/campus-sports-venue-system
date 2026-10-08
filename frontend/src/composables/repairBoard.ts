// “我的”页的报修（FE-4 规划裁决 M3）：场馆下拉（listVenues 的全部场馆，含未开放预约的）、问题描述、我的报修列表。
// 不提供场地选择，请求不带 resourceId。所有调用都经 ApiCaller（X1）。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { RepairReport, VenueSummary } from '../api/types'
import { buildRepair, REPAIR_DESCRIPTION_MAX_LENGTH } from '../utils/meDisplay'
import { useSession, type ApiCaller } from './session'

export interface RepairDeps {
  api: ApiClient
  call: ApiCaller
}

export const REPAIR_NOTICE = '报修已提交'
const VENUE_REQUIRED = '请选择场馆'
const DESCRIPTION_REQUIRED = '请填写问题描述'
const DESCRIPTION_TOO_LONG = `问题描述不能超过 ${REPAIR_DESCRIPTION_MAX_LENGTH} 个字`

// 场馆下拉与我的报修列表：两个独立的拉取，各自带错误文案，互不影响。
function createRepairData(deps: RepairDeps) {
  const venues = ref<VenueSummary[]>([])
  const venuesError = ref<string | null>(null)
  const reports = ref<RepairReport[]>([])
  const listError = ref<string | null>(null)
  const listLoaded = ref(false)

  async function loadVenues(): Promise<void> {
    const result = await deps.call(() => deps.api.listVenues())
    if (result.ok) {
      venues.value = result.value
      venuesError.value = null
    } else if (!result.sessionEnded) {
      venuesError.value = result.message
    }
  }

  async function loadReports(): Promise<void> {
    const result = await deps.call(() => deps.api.listMyRepairs())
    if (result.ok) {
      reports.value = result.value
      listError.value = null
      listLoaded.value = true
    } else if (!result.sessionEnded) {
      listError.value = result.message
    }
  }

  return { venues, venuesError, reports, listError, listLoaded, loadVenues, loadReports }
}

function validationProblem(venueId: number | null, description: string): string | null {
  if (venueId === null) {
    return VENUE_REQUIRED
  }
  if (description === '') {
    return DESCRIPTION_REQUIRED
  }
  return description.length > REPAIR_DESCRIPTION_MAX_LENGTH ? DESCRIPTION_TOO_LONG : null
}

export function createRepairBoard(deps: RepairDeps) {
  const data = createRepairData(deps)
  const venueId = ref<number | null>(null)
  const description = ref('')
  const submitting = ref(false)
  const formError = ref<string | null>(null)
  const notice = ref<string | null>(null)

  const items = computed(() => data.reports.value.map(buildRepair))

  async function load(): Promise<void> {
    await Promise.all([data.loadVenues(), data.loadReports()])
  }

  // 必填检查在前端做（venueId、description），其余规则以接口返回的错误码为准。进行中不可重复提交。
  async function submit(): Promise<void> {
    if (submitting.value) {
      return
    }
    const text = description.value.trim()
    notice.value = null
    formError.value = validationProblem(venueId.value, text)
    const target = venueId.value
    if (formError.value !== null || target === null) {
      return
    }
    submitting.value = true
    const result = await deps.call(() => deps.api.createRepair({ venueId: target, description: text }))
    if (result.ok) {
      venueId.value = null
      description.value = ''
      notice.value = REPAIR_NOTICE
      await data.loadReports()
    } else if (!result.sessionEnded) {
      formError.value = result.message
    }
    submitting.value = false
  }

  return {
    venues: data.venues, venuesError: data.venuesError, items, listError: data.listError, listLoaded: data.listLoaded,
    venueId, description, submitting, formError, notice, load, submit, reloadList: data.loadReports,
  }
}

export type RepairBoard = ReturnType<typeof createRepairBoard>

export function useRepairBoard(): RepairBoard {
  return createRepairBoard({ api, call: useSession().caller() })
}
