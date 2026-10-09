// 管理端各 board 共用的“调用 + 忙碌 + 错误文案”小工具：所有调用都经 ApiCaller（FE-5 X1）。
// 登录状态失效（sessionEnded）时已回到登录页，不再展示错误。
import { ref, type Ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { ApiCaller, ApiResult } from './session'

// 各 board 的依赖：api 实例与绑定好 router / auth 的 ApiCaller（测试注入 mock）。
export interface AdminDeps {
  api: ApiClient
  call: ApiCaller
}

// error 可由页面传入，让同一页面的几个 board 共用一条错误提示。
export function createAdminRunner(call: ApiCaller, error: Ref<string | null> = ref<string | null>(null)) {
  const busy = ref(false)

  async function run<T>(request: () => Promise<T>): Promise<ApiResult<T>> {
    busy.value = true
    error.value = null
    const result = await call(request)
    busy.value = false
    if (!result.ok && !result.sessionEnded) {
      error.value = result.message
    }
    return result
  }

  return { busy, error, run }
}

export type AdminRunner = ReturnType<typeof createAdminRunner>
