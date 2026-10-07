// mock 实现的 ApiClient（ADR-0006）：内存状态 + docs/12 的错误码与影响检查行为。
// mock 只是前端在后端未就绪阶段的替身，不是交付的后端。时间通过注入的 Clock 获取。
import type { ApiClient, ApiClientOptions } from '../client'
import type { BookingRules } from '../types'
import { adminReservationApi } from './adminReservationService'
import { authApi } from './authService'
import { MOCK_BOOKING_RULES } from './bookingRules'
import { systemClock, type Clock } from './clock'
import { contentApi } from './contentService'
import { logApi } from './logService'
import { reservationApi } from './reservationService'
import { resourceApi } from './resourceService'
import { ruleApi } from './ruleService'
import { createSeedState } from './seed'
import { statsApi } from './statsService'
import { userAdminApi } from './userService'
import { venueApi } from './venueService'
import type { MockContext, MockState } from './state'

export interface MockClientOptions extends ApiClientOptions {
  clock?: Clock
  rules?: BookingRules
  state?: MockState            // 测试可注入自定义初始状态；缺省为 docs/13 第 5 节的种子数据
}

export interface MockHandle {
  api: ApiClient
  context: MockContext         // 测试用：直接读取内部状态、调用插入层
}

export function createMockHandle(options: MockClientOptions): MockHandle {
  const clock = options.clock ?? systemClock
  const context: MockContext = {
    state: options.state ?? createSeedState(clock),
    clock,
    rules: options.rules ?? MOCK_BOOKING_RULES,
    getToken: options.getToken,
  }
  const api: ApiClient = {
    ...authApi(context),
    ...venueApi(context),
    ...reservationApi(context),
    ...adminReservationApi(context),
    ...resourceApi(context),
    ...ruleApi(context),
    ...contentApi(context),
    ...userAdminApi(context),
    ...statsApi(context),
    ...logApi(context),
  }
  return { api, context }
}

export function createMockClient(options: MockClientOptions): ApiClient {
  return createMockHandle(options).api
}
