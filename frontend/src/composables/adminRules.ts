// 开放规则（FE-5 P3）：每周开放窗口（整体替换）与特殊关闭。
// 保存窗口、新增关闭是受影响的变更，经共用的影响检查流程（P4）；删除关闭没有影响检查，确认后直接提交（FE-1 裁决 A9）。
import { computed, reactive, ref, shallowRef } from 'vue'

import type { Resource } from '../api/types'
import type { AddClosureRequest } from '../api/requests'
import type { Closure, WeeklyWindow } from '../api/typesSection5'
import {
  buildClosureRows, CLOSURE_DATES_REQUIRED_TEXT, draftFromWeekly, WEEKLY_INCOMPLETE_TEXT, windowsFromDraft, type WeeklyDraftRow,
} from '../utils/adminRuleDisplay'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { PageHooks } from './adminResources'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import type { ImpactControl } from './impactFlow'

export interface ClosureForm {
  startDate: string
  endDate: string
  resourceId: string      // '' = 整馆
  reason: string
}

export interface RemoveClosureState extends DialogBase {
  id: number
  summary: string
}

export const CLOSURE_REMOVED_NOTICE = '特殊关闭已移除'

function emptyClosureForm(): ClosureForm {
  return { startDate: '', endDate: '', resourceId: '', reason: '' }
}

// 关闭表单里的原因与影响对话框里的原因是同一个 reason 字段（docs/12 第 5.6 节）：对话框里填过的（选取消时必填）优先。
function closureRequest(form: ClosureForm, control: ImpactControl): AddClosureRequest {
  const reason = control.reason ?? (form.reason.trim() === '' ? undefined : form.reason.trim())
  return {
    startDate: form.startDate,
    endDate: form.endDate,
    ...(form.resourceId === '' ? {} : { resourceId: Number(form.resourceId) }),
    ...(reason === undefined ? {} : { reason }),
    ...(control.onExistingReservations === undefined ? {} : { onExistingReservations: control.onExistingReservations }),
    ...(control.dryRun === undefined ? {} : { dryRun: control.dryRun }),
  }
}

export function createClosures(
  deps: AdminDeps, venueId: number, hooks: PageHooks, resources: () => readonly Resource[],
) {
  const runner = createAdminRunner(deps.call, hooks.error)
  const items = shallowRef<Closure[]>([])
  const form = reactive<ClosureForm>(emptyClosureForm())
  const remove = createDialog<RemoveClosureState>()
  const rows = computed(() => buildClosureRows(items.value, resources()))

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminGetAvailabilityRules(venueId))
    if (result.ok) {
      items.value = result.value.closures
    }
  }

  async function submit(): Promise<void> {
    if (form.startDate === '' || form.endDate === '') {
      hooks.notice.value = null
      hooks.error.value = CLOSURE_DATES_REQUIRED_TEXT
      return
    }
    const snapshot = { ...form }
    await hooks.flow.start({
      title: '新增特殊关闭',
      initialReason: snapshot.reason.trim(),
      send: (control) => deps.api.adminAddClosure(venueId, closureRequest(snapshot, control)),
      applied: async () => {
        Object.assign(form, emptyClosureForm())
        await load()
      },
    })
  }

  function askRemove(id: number): void {
    const row = rows.value.find((item) => item.id === id)
    if (row !== undefined) {
      remove.open({ id, summary: `${row.rangeText} · ${row.scopeText}`, busy: false, error: null })
    }
  }

  async function confirmRemove(): Promise<void> {
    const state = remove.state.value
    if (state === null || state.busy) {
      return
    }
    hooks.notice.value = null
    const done = await submitDialog(remove, deps.call, () => deps.api.adminRemoveClosure(state.id))
    if (done) {
      hooks.notice.value = CLOSURE_REMOVED_NOTICE
    }
    await load()
  }

  return { items, form, rows, remove: remove.state, submit, askRemove, confirmRemove, dismissRemove: remove.close }
}

export function createAdminRules(deps: AdminDeps, venueId: number, hooks: PageHooks, resources: () => readonly Resource[]) {
  const runner = createAdminRunner(deps.call, hooks.error)
  const weekly = shallowRef<WeeklyWindow[]>([])
  const draft = ref<WeeklyDraftRow[]>([])
  const loaded = ref(false)
  const closures = createClosures(deps, venueId, hooks, resources)
  let nextKey = 0

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminGetAvailabilityRules(venueId))
    if (result.ok) {
      weekly.value = result.value.weekly
      closures.items.value = result.value.closures
      draft.value = draftFromWeekly(result.value.weekly)
      nextKey = draft.value.length
      loaded.value = true
    }
  }

  function addRow(): void {
    draft.value = [...draft.value, { key: nextKey, weekday: '1', openTime: '', closeTime: '' }]
    nextKey += 1
  }

  function removeRow(key: number): void {
    draft.value = draft.value.filter((row) => row.key !== key)
  }

  async function saveWeekly(): Promise<void> {
    const windows = windowsFromDraft(draft.value)
    if (windows === null) {
      hooks.notice.value = null
      hooks.error.value = WEEKLY_INCOMPLETE_TEXT
      return
    }
    await hooks.flow.start({
      title: '保存每周开放窗口',
      send: (control) => deps.api.adminReplaceWeeklyRules(venueId, { windows, ...control }),
      applied: load,
    })
  }

  return {
    weekly, draft, loaded, busy: runner.busy,
    closureForm: closures.form, closureRows: closures.rows, remove: closures.remove,
    load, addRow, removeRow, saveWeekly, submitClosure: closures.submit,
    askRemove: closures.askRemove, confirmRemove: closures.confirmRemove, dismissRemove: closures.dismissRemove,
  }
}

export type AdminRules = ReturnType<typeof createAdminRules>
