// 编辑场馆资料对话框（FE-6 G1；docs/12 第 5.5 节）：名称、类型、位置、简介，只提交改动的字段（FE-6 裁决 §5-3）。
import type { VenueSummary } from '../api/types'
import {
  buildUpdateVenueRequest, NO_CHANGE_TEXT, PROFILE_SAVED_NOTICE, venueFormProblem, type CheckedVenueForm, type VenueFormFields,
} from '../utils/sysVenueDisplay'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { AdminDeps } from './adminRunner'

export interface VenueEditState extends DialogBase, VenueFormFields {
  id: number
}

export interface VenueEditHooks {
  find(id: number): VenueSummary | undefined
  notify(text: string | null): void
  refresh(): Promise<void>
}

// 已通过 venueFormProblem 的表单：venueType 一定有值。
export function checkedVenueForm(fields: VenueFormFields): CheckedVenueForm | null {
  return fields.venueType === '' ? null : { ...fields, venueType: fields.venueType }
}

export function createVenueEditor(deps: AdminDeps, hooks: VenueEditHooks) {
  const dialog = createDialog<VenueEditState>()

  function open(id: number): void {
    const venue = hooks.find(id)
    if (venue !== undefined) {
      dialog.open({
        id, name: venue.name, venueType: venue.venueType, location: venue.location ?? '', description: venue.description ?? '',
        busy: false, error: null,
      })
    }
  }

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    const original = state === null ? undefined : hooks.find(state.id)
    if (state === null || state.busy || original === undefined) {
      return
    }
    const problem = venueFormProblem(state)
    const fields = problem === null ? checkedVenueForm(state) : null
    if (fields === null) {
      dialog.patch({ error: problem })
      return
    }
    const body = buildUpdateVenueRequest(original, fields)
    if (Object.keys(body).length === 0) {
      dialog.patch({ error: NO_CHANGE_TEXT })
      return
    }
    hooks.notify(null)
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminUpdateVenue(state.id, body))
    if (done) {
      hooks.notify(PROFILE_SAVED_NOTICE)
    }
    await hooks.refresh()
  }

  return { state: dialog.state, open, patch: dialog.patch, confirm, dismiss: dialog.close }
}
