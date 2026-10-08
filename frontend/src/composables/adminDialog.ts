// 管理端“带输入的对话框”共用的状态与提交（FE-5 P2、P3）：打开、局部更新、提交（忙碌 / 错误 / 登录失效）。
import { shallowRef, type ShallowRef } from 'vue'

import type { ApiCaller } from './session'

export interface DialogBase {
  busy: boolean
  error: string | null
}

export interface Dialog<S extends DialogBase> {
  state: ShallowRef<S | null>
  open(next: S): void
  patch(change: Partial<S>): void
  close(): void
}

export function createDialog<S extends DialogBase>(): Dialog<S> {
  const state = shallowRef(null) as ShallowRef<S | null>
  return {
    state,
    open: (next) => { state.value = next },
    patch: (change) => { state.value = state.value === null ? null : Object.assign({}, state.value, change) },
    close: () => { state.value = null },
  }
}

// 提交对话框里的请求：进行中不可重复提交；成功后关闭并返回 true；失败时对话框保持并显示文案（登录失效则直接关闭）。
export async function submitDialog<S extends DialogBase>(
  dialog: Dialog<S>, call: ApiCaller, request: () => Promise<unknown>,
): Promise<boolean> {
  const current = dialog.state.value
  if (current === null || current.busy) {
    return false
  }
  dialog.patch({ busy: true, error: null } as Partial<S>)
  const result = await call(request)
  if (result.ok || result.sessionEnded) {
    dialog.close()
  } else {
    dialog.patch({ busy: false, error: result.message } as Partial<S>)
  }
  return result.ok
}
