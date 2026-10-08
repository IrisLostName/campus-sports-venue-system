// 影响检查流程（docs/12 第 5.5 节，docs/03 第 6 节；FE-5 P4）：所有受影响的变更共用这一个组合函数 + ImpactDialog。
// 先 dryRun 预检；无受影响预约时普通确认后直接提交（不带 onExistingReservations）；
// 有受影响预约时必须明确选择 KEEP 或 CANCEL（无默认），CANCEL 须填原因；提交时若再收到 IMPACT_CONFIRMATION_REQUIRED，用 details.impact 重新打开。
import { ref, type Ref } from 'vue'

import { ApiError } from '../api/errors'
import type { ImpactChangeResponse, ImpactReport, OnExisting } from '../api/types'
import { messageFor } from '../utils/errorMessages'
import { CHOICE_REQUIRED_TEXT, impactDoneText, parseImpact } from '../utils/impactDisplay'
import type { ApiCaller } from './session'

export interface ImpactControl {
  dryRun?: boolean
  onExistingReservations?: OnExisting
  reason?: string
}

export interface ImpactChange<T> {
  title: string
  initialReason?: string                                     // 选 CANCEL 时对话框原因的预填值（例如关闭表单中的原因）
  send(control: ImpactControl): Promise<ImpactChangeResponse<T>>
  applied(response: ImpactChangeResponse<T>): Promise<void> | void
}

export interface ImpactDialogState {
  title: string
  impact: ImpactReport
  choice: OnExisting | null
  reason: string
  busy: boolean
  error: string | null
}

type Failure = { ok: false; code: string; message: string; sessionEnded: boolean; impact: ImpactReport | null }
type Outcome = { ok: true; impact: ImpactReport; cancelledCount: number } | Failure

interface Pending {
  title: string
  initialReason: string
  execute(control: ImpactControl): Promise<Outcome>
}

function problemOf(state: ImpactDialogState): string | null {
  if (state.impact.affectedCount === 0) {
    return null
  }
  if (state.choice === null) {
    return CHOICE_REQUIRED_TEXT
  }
  return state.choice === 'CANCEL' && state.reason.trim() === '' ? messageFor('REASON_REQUIRED') : null
}

function controlOf(state: ImpactDialogState): ImpactControl {
  if (state.impact.affectedCount === 0 || state.choice === null) {
    return {}
  }
  const reason = state.reason.trim()
  return reason === '' ? { onExistingReservations: state.choice } : { onExistingReservations: state.choice, reason }
}

// 把带类型参数的变更收成与 T 无关的 Pending：409 的 details 在 describeError 里会丢失，所以在请求内部先取走。
function makePending<T>(change: ImpactChange<T>, deps: { call: ApiCaller }): Pending {
  return {
    title: change.title,
    initialReason: change.initialReason ?? '',
    async execute(control) {
      const captured: { impact: ImpactReport | null } = { impact: null }
      const result = await deps.call(async () => {
        try {
          return await change.send(control)
        } catch (error) {
          if (error instanceof ApiError && error.code === 'IMPACT_CONFIRMATION_REQUIRED') {
            captured.impact = parseImpact(error.details?.impact)
          }
          throw error
        }
      })
      if (!result.ok) {
        return { ok: false, code: result.code, message: result.message, sessionEnded: result.sessionEnded, impact: captured.impact }
      }
      if (control.dryRun !== true) {
        await change.applied(result.value)
      }
      return { ok: true, impact: result.value.impact, cancelledCount: result.value.cancelledIds.length }
    },
  }
}

export interface ImpactFlowDeps {
  call: ApiCaller
  error?: Ref<string | null>      // 页面可传入共用的错误 / 提示，使同一页面的几个 board 共用一条提示
  notice?: Ref<string | null>
}

export function createImpactFlow(deps: ImpactFlowDeps) {
  const dialog = ref<ImpactDialogState | null>(null)
  const checking = ref(false)
  const error = deps.error ?? ref<string | null>(null)
  const notice = deps.notice ?? ref<string | null>(null)
  let pending: Pending | null = null

  function dismiss(): void {
    dialog.value = null
    pending = null
  }

  async function start<T>(change: ImpactChange<T>): Promise<void> {
    if (checking.value || dialog.value !== null) {
      return
    }
    error.value = null
    notice.value = null
    checking.value = true
    const next = makePending(change, deps)
    const outcome = await next.execute({ dryRun: true })
    checking.value = false
    if (!outcome.ok) {
      error.value = outcome.sessionEnded ? null : outcome.message
      return
    }
    pending = next
    dialog.value = { title: next.title, impact: outcome.impact, choice: null, reason: next.initialReason, busy: false, error: null }
  }

  function fail(state: ImpactDialogState, outcome: Failure): void {
    if (outcome.sessionEnded) {
      dismiss()
    } else if (outcome.code === 'IMPACT_CONFIRMATION_REQUIRED' && outcome.impact !== null) {
      dialog.value = { ...state, impact: outcome.impact, choice: null, busy: false, error: outcome.message }
    } else {
      dialog.value = { ...state, busy: false, error: outcome.message }
    }
  }

  async function confirm(): Promise<void> {
    const state = dialog.value
    if (state === null || pending === null || state.busy) {
      return
    }
    const problem = problemOf(state)
    if (problem !== null) {
      dialog.value = { ...state, error: problem }
      return
    }
    dialog.value = { ...state, busy: true, error: null }
    const outcome = await pending.execute(controlOf(state))
    if (outcome.ok) {
      notice.value = impactDoneText(state.choice, outcome.cancelledCount)
      dismiss()
    } else {
      fail(state, outcome)
    }
  }

  function choose(choice: OnExisting): void {
    if (dialog.value !== null && !dialog.value.busy) {
      dialog.value = { ...dialog.value, choice, error: null }
    }
  }

  function setReason(reason: string): void {
    if (dialog.value !== null) {
      dialog.value = { ...dialog.value, reason }
    }
  }

  return { dialog, checking, error, notice, start, choose, setReason, confirm, dismiss }
}

export type ImpactFlow = ReturnType<typeof createImpactFlow>
