// 全局前置守卫：等待启动恢复完成后，按登录角色放行或跳转（docs/02 第 3.1 节）。
import type { NavigationGuard } from 'vue-router'

import type { Role } from '../api/types'
import { decideNavigation } from './access'

export interface GuardAuth {
  restore(): Promise<void>
  role: Role | null
}

export function createAuthGuard(getAuth: () => GuardAuth): NavigationGuard {
  return async (to) => {
    const auth = getAuth()
    await auth.restore()
    return decideNavigation(to, auth.role)
  }
}
