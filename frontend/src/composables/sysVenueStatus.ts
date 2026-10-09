// 场馆的开关与运营状态（FE-6 G1；docs/12 第 5.5 节）：
//   - 开放预约开关 userBookingEnabled：直接提交，不做影响检查（FE-1 裁决 A9）；
//   - 运营状态改为 CLOSED：走 FE-5 的影响检查流程（impactFlow + ImpactDialog）；改回 OPEN 直接提交。
import type { Ref } from 'vue'

import type { VenueSummary } from '../api/types'
import { bookingNotice, REOPENED_NOTICE } from '../utils/sysVenueDisplay'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { createImpactFlow } from './impactFlow'

export interface VenueStatusHooks {
  find(id: number): VenueSummary | undefined
  refresh(): Promise<void>
  error: Ref<string | null>
  notice: Ref<string | null>
}

export function createVenueStatus(deps: AdminDeps, hooks: VenueStatusHooks) {
  const runner = createAdminRunner(deps.call, hooks.error)
  const flow = createImpactFlow({ call: deps.call, error: hooks.error, notice: hooks.notice })

  // 无论成败都与服务端对齐（失败时让开关回到服务端的值）；重新取数会清掉错误，所以失败文案在对齐之后再显示。
  async function finish(result: { ok: boolean; message?: string; sessionEnded?: boolean }, success: string): Promise<void> {
    hooks.notice.value = result.ok ? success : null
    await hooks.refresh()
    if (!result.ok && result.sessionEnded !== true) {
      hooks.error.value = result.message ?? null
    }
  }

  async function toggleBooking(id: number, enabled: boolean): Promise<void> {
    const venue = hooks.find(id)
    if (venue === undefined || runner.busy.value) {
      return
    }
    hooks.notice.value = null
    const result = await runner.run(() => deps.api.adminUpdateVenue(id, { userBookingEnabled: enabled }))
    await finish(result, bookingNotice(venue.name, enabled))
  }

  async function reopen(id: number): Promise<void> {
    const venue = hooks.find(id)
    if (venue === undefined || venue.operationalStatus !== 'CLOSED' || runner.busy.value) {
      return
    }
    hooks.notice.value = null
    const result = await runner.run(() => deps.api.adminUpdateVenue(id, { operationalStatus: 'OPEN' }))
    await finish(result, REOPENED_NOTICE)
  }

  async function askClose(id: number): Promise<void> {
    const venue = hooks.find(id)
    if (venue === undefined || venue.operationalStatus !== 'OPEN') {
      return
    }
    await flow.start({
      title: `关闭场馆：${venue.name}`,
      send: (control) => deps.api.adminUpdateVenue(id, { operationalStatus: 'CLOSED', ...control }),
      applied: hooks.refresh,
    })
  }

  return { flow, busy: runner.busy, toggleBooking, reopen, askClose }
}
