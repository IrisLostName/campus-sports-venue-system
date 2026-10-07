// FE-3 测试脚手架：在 FE-2 的认证脚手架（Pinia + 内存路由 + mock ApiClient + 注入时钟）上登录一个用户，
// 并接好“预约”页与首页的控制器。全部在 Node 环境运行，不用真实时间。
import { createPinia } from 'pinia'

import type { ApiClient } from '../../src/api/client'
import { createHomeBoard, type HomeBoard } from '../../src/composables/homeBoard'
import { createReservationBoard, type ReservationBoard } from '../../src/composables/reservationBoard'
import { callApi, type ApiCaller } from '../../src/composables/session'
import { defineReferenceStore, type ReferenceStore } from '../../src/stores/reference'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from '../auth/harness'

export { DEMO_PASSWORD }

// 种子里的“今天”是 2026-10-12（周一，09:00），zhangsan 的预约在明天 2026-10-13 08:00–09:30，网球场1（id 1）。
// 默认规则：开始前 120 分钟截止取消；07:45 起可签到，08:15 止；09:30 结束；10:00 后不能再签退。
export const TOMORROW = '2026-10-13'
export const MINUTES_OVER_TOKEN_LIFETIME = 8 * 60 + 1

export function at(time: string): string {
  return `${TOMORROW}T${time}:00`
}

export interface UserContext {
  h: AuthHarness
  call: ApiCaller
  reference: ReferenceStore
  // 默认使用 h.api；测试可传入包装过的 api（例如统计调用次数）。
  reservationBoard(api?: ApiClient): ReservationBoard
  homeBoard(api?: ApiClient): HomeBoard
  // 把时钟拨到某一时刻并重新登录（令牌 8 小时过期，跨度大的跳转必须重新登录）。
  travelTo(timestamp: string): Promise<void>
}

export async function loginAs(username: string, startPath: string): Promise<UserContext> {
  const h = createAuthHarness()
  const result = await h.auth.login({ username, password: DEMO_PASSWORD })
  if (!result.ok) {
    throw new Error(`${username} 登录失败：${result.code}`)
  }
  await h.router.push(startPath)
  const call: ApiCaller = (request) => callApi(request, { auth: h.auth, router: h.router })
  const reference = defineReferenceStore({ api: h.api })(createPinia())
  return {
    h, call, reference,
    reservationBoard: (api = h.api) => createReservationBoard({ api, call, reference }),
    homeBoard: (api = h.api) => createHomeBoard({ api, call }),
    async travelTo(timestamp) {
      h.clock.set(timestamp)
      await h.auth.login({ username, password: DEMO_PASSWORD })
    },
  }
}
