// 扫码签到的提交、结果与最近记录（P2-1c 裁决第 3 节；docs/12 第 5.7 节 POST /admin/check-ins）。
// 摄像头、扫码枪与手动输入都从 submit 进入；去重只在摄像头路径（composables/scanCamera），这里每次都提交。
// 调用经 ApiCaller（登录失效回登录页）；业务错误在请求内捕获，保留 details（签到窗口、状态）供结果面板说明。
import { ref } from 'vue'

import type { ApiClient } from '../api/client'
import { ApiError } from '../api/errors'
import { api } from '../api/index'
import type { AdminReservation } from '../api/typesSection5'
import { scanFailure, scanSuccess, type ScanOutcome } from '../utils/checkInDisplay'
import { isSessionFailure } from '../utils/sessionErrors'
import { nowShanghai } from '../utils/shanghaiTime'
import { useSession, type ApiCaller } from './session'

export const HISTORY_LIMIT = 10

export type ScanSource = 'camera' | 'input'

export interface ScanHistoryEntry {
  seq: number
  time: string          // HH:mm:ss（客户端时间，只用于列表）
  ok: boolean
  title: string
  summary: string
}

export interface AdminCheckInDeps {
  api: ApiClient
  call: ApiCaller
  clock?: () => string  // 场馆本地时间戳，缺省为客户端当前时间
}

type Attempt = { ok: true; value: AdminReservation } | { ok: false; error: ApiError }

function summaryOf(outcome: ScanOutcome, code: string): string {
  if (outcome.ok) {
    return outcome.facts.slice(0, 3).map((fact) => fact.value).join(' · ')
  }
  return outcome.detail ?? code
}

export function createAdminCheckIn(deps: AdminCheckInDeps) {
  const busy = ref(false)
  const outcome = ref<ScanOutcome | null>(null)
  const history = ref<ScanHistoryEntry[]>([])
  const clock = deps.clock ?? nowShanghai
  let seq = 0

  function record(result: ScanOutcome, code: string): void {
    outcome.value = result
    seq += 1
    const entry: ScanHistoryEntry = {
      seq, time: clock().slice('YYYY-MM-DDT'.length, 'YYYY-MM-DDTHH:mm:ss'.length),
      ok: result.ok, title: result.title, summary: summaryOf(result, code),
    }
    history.value = [entry, ...history.value].slice(0, HISTORY_LIMIT)
  }

  // 提交一个码；空白忽略，进行中不重复提交。返回是否发出了请求。
  async function submit(raw: string): Promise<boolean> {
    const code = raw.trim()
    if (code === '' || busy.value) {
      return false
    }
    busy.value = true
    const result = await deps.call<Attempt>(async () => {
      try {
        return { ok: true, value: await deps.api.adminCheckIn({ code }) }
      } catch (error) {
        if (error instanceof ApiError && !isSessionFailure(error.code)) {
          return { ok: false, error }
        }
        throw error
      }
    })
    if (result.ok) {
      const attempt = result.value
      record(attempt.ok ? scanSuccess(attempt.value) : scanFailure(attempt.error.code, attempt.error.details), code)
    } else if (!result.sessionEnded) {
      record(scanFailure(result.code, undefined), code)
    }
    busy.value = false
    return true
  }

  return { busy, outcome, history, submit }
}

export type AdminCheckIn = ReturnType<typeof createAdminCheckIn>

export function useAdminCheckIn(): AdminCheckIn {
  return createAdminCheckIn({ api, call: useSession().caller() })
}
