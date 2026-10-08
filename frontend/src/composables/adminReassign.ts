// 预约的资源改派（FE-5 P2；docs/12 第 5.7 节）：目标场地取自占用总览，可选时段只取状态为 AVAILABLE 的格子；
// 日期不限于未来 7 天（不受 advanceDays 限制）。原因必填，其余规则以接口错误码为准。
import { messageFor } from '../utils/errorMessages'
import {
  buildReassignOptions, opsFor, reservationSummary, TARGET_RESOURCE_REQUIRED_TEXT, TARGET_START_REQUIRED_TEXT,
  type ReassignResourceOption,
} from '../utils/adminReservationDisplay'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { ActionHooks } from './adminReservationActions'
import type { AdminDeps } from './adminRunner'

export interface ReassignState extends DialogBase {
  id: number
  venueId: number
  summary: string
  date: string
  options: ReassignResourceOption[]
  loading: boolean
  resourceId: string      // select 的值，'' 表示未选
  startTime: string
  reason: string
}

export const RESOURCE_REASSIGNED_NOTICE = '已改派场地'

export function createReassign(deps: AdminDeps, hooks: ActionHooks) {
  const dialog = createDialog<ReassignState>()

  async function loadOptions(venueId: number, date: string): Promise<void> {
    const result = await deps.call(() => deps.api.adminGetOccupancy(venueId, date))
    if (dialog.state.value?.date !== date) {
      return    // 期间又换了日期或关闭了对话框，这次结果作废
    }
    if (result.ok) {
      dialog.patch({ options: buildReassignOptions(result.value), loading: false })
    } else if (result.sessionEnded) {
      dialog.close()
    } else {
      dialog.patch({ loading: false, error: result.message })
    }
  }

  async function open(id: number): Promise<void> {
    const reservation = hooks.find(id)
    if (reservation === undefined || !opsFor(reservation).includes('REASSIGN_RESOURCE')) {
      return
    }
    dialog.open({
      id, venueId: reservation.venueId, summary: reservationSummary(reservation), date: reservation.serviceDate,
      options: [], loading: true, resourceId: '', startTime: '', reason: '', busy: false, error: null,
    })
    await loadOptions(reservation.venueId, reservation.serviceDate)
  }

  // 换日期：目标场地与时间清空，重新取该日的占用总览。日期输入被清空时忽略。
  async function setDate(date: string): Promise<void> {
    const state = dialog.state.value
    if (state === null || date === '' || date === state.date) {
      return
    }
    dialog.patch({ date, options: [], loading: true, resourceId: '', startTime: '', error: null })
    await loadOptions(state.venueId, date)
  }

  function problemOf(state: ReassignState): string | null {
    if (state.resourceId === '') {
      return TARGET_RESOURCE_REQUIRED_TEXT
    }
    if (state.startTime === '') {
      return TARGET_START_REQUIRED_TEXT
    }
    return state.reason.trim() === '' ? messageFor('REASON_REQUIRED') : null
  }

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    const problem = problemOf(state)
    if (problem !== null) {
      dialog.patch({ error: problem })
      return
    }
    const body = { resourceId: Number(state.resourceId), serviceDate: state.date, startTime: state.startTime, reason: state.reason.trim() }
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminReassignResource(state.id, body))
    if (done) {
      hooks.notify(RESOURCE_REASSIGNED_NOTICE)
    }
    await hooks.refresh()
  }

  return { state: dialog.state, open, setDate, patch: dialog.patch, confirm, dismiss: dialog.close }
}
