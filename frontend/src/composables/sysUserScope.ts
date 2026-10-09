// 场馆管理员的授权范围（FE-6 G2；docs/12 第 5.9 节）：多选场馆，整体替换（adminSetVenueScope）。
// 目标必须是场馆管理员；空选择表示不授权任何场馆。
import { SCOPE_SAVED_NOTICE } from '../utils/sysUserDisplay'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { AdminDeps } from './adminRunner'

export interface ScopeState extends DialogBase {
  id: number
  name: string
  venueIds: number[]
}

export interface ScopeHooks {
  find(id: number): { displayName: string; venueIds: number[] | null; role: string } | undefined
  notify(text: string): void
  refresh(): Promise<void>
}

export function createUserScope(deps: AdminDeps, hooks: ScopeHooks) {
  const dialog = createDialog<ScopeState>()

  function open(id: number): void {
    const user = hooks.find(id)
    if (user !== undefined && user.role === 'VENUE_ADMIN') {
      dialog.open({ id, name: user.displayName, venueIds: [...(user.venueIds ?? [])], busy: false, error: null })
    }
  }

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminSetVenueScope(state.id, { venueIds: state.venueIds }))
    if (done) {
      hooks.notify(SCOPE_SAVED_NOTICE)
    }
    await hooks.refresh()
  }

  return { state: dialog.state, open, patch: dialog.patch, confirm, dismiss: dialog.close }
}
