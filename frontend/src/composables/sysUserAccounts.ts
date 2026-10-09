// 账号的三个对话框操作（FE-6 G3；docs/12 第 5.9 节）：新建账号、改显示名、停用 / 启用。
// 密码只存在于“新建账号”对话框的状态里：创建成功或关闭对话框后随状态丢弃，不显示、不回显、不写入提示或日志。
import type { AccountStatus, UserProfile } from '../api/types'
import {
  buildCreateUserRequest, CREATED_NOTICE, emptyUserForm, NAME_REQUIRED_TEXT, RENAMED_NOTICE, statusNotice, userFormProblem,
  type UserFormFields,
} from '../utils/sysUserDisplay'
import type { Role } from '../api/types'
import { createDialog, submitDialog, type DialogBase } from './adminDialog'
import type { AdminDeps } from './adminRunner'
import type { ApiResult } from './session'

export interface CreateUserState extends DialogBase, UserFormFields {}

export interface RenameUserState extends DialogBase {
  id: number
  displayName: string
}

export interface DisableUserState extends DialogBase {
  id: number
  name: string
}

export interface AccountHooks {
  find(id: number): UserProfile | undefined
  selfId(): number | null
  fixedRole: Role | undefined
  notify(text: string | null): void
  reload(page?: number): Promise<void>
  run<T>(request: () => Promise<T>): Promise<ApiResult<T>>   // 经 ApiCaller，失败文案显示在页面的错误提示里
}

function createCreateDialog(deps: AdminDeps, hooks: AccountHooks) {
  const dialog = createDialog<CreateUserState>()

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    const problem = userFormProblem(state)
    if (problem !== null) {
      dialog.patch({ error: problem })
      return
    }
    const body = buildCreateUserRequest(state)
    hooks.notify(null)
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminCreateUser(body))
    if (done) {
      hooks.notify(CREATED_NOTICE)
      await hooks.reload(1)
    }
  }

  const open = (): void => dialog.open({ ...emptyUserForm(hooks.fixedRole ?? 'USER'), busy: false, error: null })
  return { state: dialog.state, open, patch: dialog.patch, confirm, dismiss: dialog.close }
}

function createRenameDialog(deps: AdminDeps, hooks: AccountHooks) {
  const dialog = createDialog<RenameUserState>()

  function open(id: number): void {
    const user = hooks.find(id)
    if (user !== undefined) {
      dialog.open({ id, displayName: user.displayName, busy: false, error: null })
    }
  }

  async function confirm(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    const displayName = state.displayName.trim()
    if (displayName === '') {
      dialog.patch({ error: NAME_REQUIRED_TEXT })
      return
    }
    hooks.notify(null)
    const done = await submitDialog(dialog, deps.call, () => deps.api.adminUpdateUser(state.id, { displayName }))
    if (done) {
      hooks.notify(RENAMED_NOTICE)
    }
    await hooks.reload()
  }

  return { state: dialog.state, open, patch: dialog.patch, confirm, dismiss: dialog.close }
}

// 停用需要确认（对话框），启用直接提交（FE-6 裁决 §5-6）。自己的账号不能停用（后端仍会返回 INVALID_STATE）。
function createStatusActions(deps: AdminDeps, hooks: AccountHooks) {
  const dialog = createDialog<DisableUserState>()

  function askDisable(id: number): void {
    const user = hooks.find(id)
    if (user !== undefined && user.id !== hooks.selfId() && user.status === 'ACTIVE') {
      dialog.open({ id, name: user.displayName, busy: false, error: null })
    }
  }

  async function confirmDisable(): Promise<void> {
    const state = dialog.state.value
    if (state === null || state.busy) {
      return
    }
    dialog.patch({ busy: true, error: null })
    const result = await deps.call(() => deps.api.adminUpdateUser(state.id, { status: 'DISABLED' }))
    if (result.ok || result.sessionEnded) {
      dialog.close()
      hooks.notify(result.ok ? statusNotice(state.name, 'DISABLED') : null)
      await hooks.reload()
    } else {
      dialog.patch({ busy: false, error: result.message })
    }
  }

  async function enable(id: number): Promise<void> {
    const user = hooks.find(id)
    if (user === undefined || user.status !== 'DISABLED') {
      return
    }
    const status: AccountStatus = 'ACTIVE'
    hooks.notify(null)
    const result = await hooks.run(() => deps.api.adminUpdateUser(id, { status }))
    hooks.notify(result.ok ? statusNotice(user.displayName, status) : null)
    await hooks.reload()
  }

  return { state: dialog.state, askDisable, confirmDisable, dismiss: dialog.close, enable }
}

export function createUserAccounts(deps: AdminDeps, hooks: AccountHooks) {
  return { create: createCreateDialog(deps, hooks), rename: createRenameDialog(deps, hooks), status: createStatusActions(deps, hooks) }
}
