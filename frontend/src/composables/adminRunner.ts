// 管理端各 board 共用的“调用 + 忙碌 + 错误文案”小工具：所有调用都经 ApiCaller（FE-5 X1）。
// 登录状态失效（sessionEnded）时已回到登录页，不再展示错误。
import { ref } from 'vue'

import type { ApiCaller, ApiResult } from './session'

export function createAdminRunner(call: ApiCaller) {
  const busy = ref(false)
  const error = ref<string | null>(null)

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
