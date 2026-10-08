// 场地（FE-5 P3）：列表（含 DISABLED）、改名、改状态、设定场地数量。
// 改状态与设定数量都是受影响的变更，经共用的影响检查流程（impactFlow + ImpactDialog，P4）；改名不影响预约，直接提交。
import { computed, reactive, ref, shallowRef, type Ref } from 'vue'

import type { Resource, ResourceStatus, ResourceType } from '../api/types'
import type { SetResourceCountRequest } from '../api/requests'
import {
  buildResourceRows, COUNT_INVALID_TEXT, EMPTY_VENUE_COUNT_TEXT, NAME_REQUIRED_TEXT, parseCount, statusActionsFor,
} from '../utils/adminResourceDisplay'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import type { ImpactFlow } from './impactFlow'

// 页面里这组 board 共用的东西：影响检查流程、共用的错误 / 提示，以及所选场馆的资料（来自外壳的场馆上下文）。
export interface VenueInfo {
  resourceCount(): number | undefined
  description(): string
  reload(): Promise<void>
}

export interface PageHooks {
  flow: ImpactFlow
  error: Ref<string | null>
  notice: Ref<string | null>
  venue: VenueInfo
}

export interface RenameState extends DialogBase {
  id: number
  name: string
}

export interface CountForm {
  count: string
  namePrefix: string
  resourceType: ResourceType | ''
}

export const RENAMED_NOTICE = '场地已改名'

// 改名：名称不能为空，其余以接口为准。
function createRename(deps: AdminDeps, hooks: PageHooks, items: () => readonly Resource[], reload: () => Promise<void>) {
  const dialog = createDialog<RenameState>()

  function open(id: number): void {
    const resource = items().find((item) => item.id === id)
    if (resource !== undefined) {
      dialog.open({ id, name: resource.name, busy: false, error: null })
    }
  }

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    const name = state.name.trim()
    if (name === '') {
      dialog.patch({ error: NAME_REQUIRED_TEXT })
      return
    }
    hooks.notice.value = null
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminUpdateResource(state.id, { name }))
    if (done) {
      hooks.notice.value = RENAMED_NOTICE
    }
    await reload()
  }

  return { state: dialog.state, open, patch: dialog.patch, confirm, dismiss: dialog.close }
}

// 数量表单：0–50 的整数；名称前缀 / 场地类型可留空，场馆当前没有任何场地时必填（FE-5 裁决 Q5）。
function createCountForm(
  deps: AdminDeps, venueId: number, hooks: PageHooks, items: () => readonly Resource[], refresh: () => Promise<void>,
) {
  const form = reactive<CountForm>({ count: '', namePrefix: '', resourceType: '' })

  function request(): SetResourceCountRequest | string {
    const count = parseCount(form.count)
    if (count === null) {
      return COUNT_INVALID_TEXT
    }
    const prefix = form.namePrefix.trim()
    if (items().length === 0 && (prefix === '' || form.resourceType === '')) {
      return EMPTY_VENUE_COUNT_TEXT
    }
    return {
      count,
      ...(prefix === '' ? {} : { namePrefix: prefix }),
      ...(form.resourceType === '' ? {} : { resourceType: form.resourceType }),
    }
  }

  async function submit(): Promise<void> {
    const body = request()
    if (typeof body === 'string') {
      hooks.notice.value = null
      hooks.error.value = body
      return
    }
    await hooks.flow.start({
      title: `将场地数量设为 ${body.count}`,
      send: (control) => deps.api.adminSetResourceCount(venueId, { ...body, ...control }),
      applied: refresh,
    })
  }

  function sync(): void {
    form.count = String(hooks.venue.resourceCount() ?? '')
  }

  return { form, submit, sync }
}

export function createAdminResources(deps: AdminDeps, venueId: number, hooks: PageHooks) {
  const runner = createAdminRunner(deps.call, hooks.error)
  const items = shallowRef<Resource[]>([])
  const loaded = ref(false)
  const rows = computed(() => buildResourceRows(items.value))

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminListResources(venueId))
    if (result.ok) {
      items.value = result.value
      loaded.value = true
    }
  }

  const count = createCountForm(deps, venueId, hooks, () => items.value, refreshAll)
  const rename = createRename(deps, hooks, () => items.value, load)

  // 受影响的变更生效后：场地列表和外壳里的场馆资料（场地数量）都要刷新。
  async function refreshAll(): Promise<void> {
    await Promise.all([load(), hooks.venue.reload()])
    count.sync()
  }

  async function changeStatus(id: number, target: ResourceStatus): Promise<void> {
    const resource = items.value.find((item) => item.id === id)
    const action = resource === undefined ? undefined : statusActionsFor(resource.operationalStatus).find((item) => item.target === target)
    if (resource === undefined || action === undefined) {
      return
    }
    await hooks.flow.start({
      title: `将 ${resource.name} ${action.label}`,
      send: (control) => deps.api.adminUpdateResource(id, { operationalStatus: target, ...control }),
      applied: refreshAll,
    })
  }

  return {
    items, loaded, rows, rename: rename.state, form: count.form, busy: runner.busy,
    load, syncCount: count.sync, openRename: rename.open, patchRename: rename.patch, confirmRename: rename.confirm,
    dismissRename: rename.dismiss, changeStatus, submitCount: count.submit,
  }
}

export type AdminResources = ReturnType<typeof createAdminResources>
