// 预约管理里的两种“填原因”的操作（FE-5 P2）：取消、人员改派。原因必填（REASON_REQUIRED），其余规则以接口错误码为准。
import { messageFor } from '../utils/errorMessages'
import { parseUserId, reservationSummary, opsFor, USER_ID_INVALID_TEXT } from '../utils/adminReservationDisplay'
import type { AdminReservation } from '../api/typesSection5'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { AdminDeps } from './adminRunner'

export interface ActionHooks {
  find(id: number): AdminReservation | undefined
  refresh(): Promise<void>
  notify(text: string): void
}

export interface CancelState extends DialogBase {
  id: number
  summary: string
  reason: string
}

export interface UserReassignState extends DialogBase {
  id: number
  summary: string
  userId: string          // 输入框里的文本，提交时解析为数字
  reason: string
}

export const CANCELLED_NOTICE = '预约已取消'
export const USER_REASSIGNED_NOTICE = '已改派预约人'

export function createReservationActions(deps: AdminDeps, hooks: ActionHooks) {
  const cancel = createDialog<CancelState>()
  const user = createDialog<UserReassignState>()

  function openCancel(id: number): void {
    const reservation = hooks.find(id)
    if (reservation !== undefined && opsFor(reservation).includes('CANCEL')) {
      cancel.open({ id, summary: reservationSummary(reservation), reason: '', busy: false, error: null })
    }
  }

  function openUser(id: number): void {
    const reservation = hooks.find(id)
    if (reservation !== undefined && opsFor(reservation).includes('REASSIGN_USER')) {
      user.open({ id, summary: reservationSummary(reservation), userId: '', reason: '', busy: false, error: null })
    }
  }

  // 成功提示 + 无论成败都与服务端对齐（例如 INVALID_STATE 说明列表已过期）。
  async function finish(done: boolean, text: string): Promise<void> {
    if (done) {
      hooks.notify(text)
    }
    await hooks.refresh()
  }

  async function confirmCancel(): Promise<void> {
    const state = cancel.state.value
    if (state === null || state.busy) {
      return
    }
    const reason = state.reason.trim()
    if (reason === '') {
      cancel.patch({ error: messageFor('REASON_REQUIRED') })
      return
    }
    const done = await submitDialog(cancel, deps.call, () => deps.api.adminCancelReservation(state.id, { reason }))
    await finish(done, CANCELLED_NOTICE)
  }

  async function confirmUser(): Promise<void> {
    const state = user.state.value
    if (state === null || state.busy) {
      return
    }
    const userId = parseUserId(state.userId)
    const reason = state.reason.trim()
    if (userId === null) {
      user.patch({ error: USER_ID_INVALID_TEXT })
      return
    }
    if (reason === '') {
      user.patch({ error: messageFor('REASON_REQUIRED') })
      return
    }
    const done = await submitDialog(user, deps.call, () => deps.api.adminReassignUser(state.id, { userId, reason }))
    await finish(done, USER_REASSIGNED_NOTICE)
  }

  return {
    cancel: cancel.state, user: user.state,
    openCancel, patchCancel: cancel.patch, confirmCancel, dismissCancel: cancel.close,
    openUser, patchUser: user.patch, confirmUser, dismissUser: user.close,
  }
}
