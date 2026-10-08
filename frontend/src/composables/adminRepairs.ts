// 报修处理（FE-5 P7）：adminListRepairs（所选场馆、状态筛选、分页）与 adminUpdateRepair。
// 按钮由 status 决定；标记已解决须填处理结果（resultNote），其余规则以接口错误码为准。
import { computed, ref } from 'vue'

import { api } from '../api/index'
import type { RepairStatus } from '../api/types'
import type { AdminRepairsQuery } from '../api/requests'
import { buildRepairRow, RESULT_REQUIRED_TEXT, type RepairTarget } from '../utils/adminRepairDisplay'
import { createPagedList } from './adminPaged'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export interface ResolveDialogState {
  id: number
  note: string
  busy: boolean
  error: string | null
}

export const REPAIR_UPDATED_NOTICE = '报修已更新'

export function createAdminRepairs(deps: AdminDeps, venueId: number) {
  const status = ref<RepairStatus | ''>('')
  const list = createPagedList(deps.call, (page) => {
    const query: AdminRepairsQuery = { venueId, page }
    if (status.value !== '') {
      query.status = status.value
    }
    return deps.api.adminListRepairs(query)
  })
  const runner = createAdminRunner(deps.call)
  const notice = ref<string | null>(null)
  const dialog = ref<ResolveDialogState | null>(null)
  const rows = computed(() => list.items.value.map(buildRepairRow))

  async function setStatus(next: RepairStatus | ''): Promise<void> {
    status.value = next
    notice.value = null
    await list.load(1)
  }

  async function update(id: number, target: RepairTarget, resultNote?: string) {
    const body = resultNote === undefined ? { status: target } : { status: target, resultNote }
    const result = await runner.run(() => deps.api.adminUpdateRepair(id, body))
    if (result.ok) {
      notice.value = REPAIR_UPDATED_NOTICE
      await list.load()
    }
    return result
  }

  // 开始处理直接提交；标记已解决先打开“处理结果”对话框。
  async function advance(id: number, target: RepairTarget): Promise<void> {
    notice.value = null
    if (target === 'RESOLVED') {
      dialog.value = { id, note: '', busy: false, error: null }
    } else if (!runner.busy.value) {
      await update(id, target)
    }
  }

  function setNote(note: string): void {
    if (dialog.value !== null) {
      dialog.value = { ...dialog.value, note }
    }
  }

  async function confirmResolve(): Promise<void> {
    const state = dialog.value
    if (state === null || state.busy) {
      return
    }
    const note = state.note.trim()
    if (note === '') {
      dialog.value = { ...state, error: RESULT_REQUIRED_TEXT }
      return
    }
    dialog.value = { ...state, busy: true, error: null }
    const result = await update(state.id, 'RESOLVED', note)
    dialog.value = result.ok || result.sessionEnded ? null : { ...state, note, busy: false, error: result.message }
  }

  function dismissResolve(): void {
    dialog.value = null
  }

  return {
    status, list, rows, notice, dialog, error: runner.error, setStatus, advance, setNote, confirmResolve, dismissResolve,
    load: () => list.load(1), goTo: (page: number) => list.load(page),
  }
}

export function useAdminRepairs(venueId: number) {
  return createAdminRepairs({ api, call: useSession().caller() }, venueId)
}
