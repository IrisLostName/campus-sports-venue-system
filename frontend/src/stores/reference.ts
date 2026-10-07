// 参照数据：本包只放 BookingRules（FE-3 规划裁决 R1），加载一次并缓存；场馆列表由 FE-4 按需添加。
// 调用经由传入的 ApiCaller（即 composables/session 的 callApi），失败不缓存，下次可重试。
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { BookingRules } from '../api/types'
import type { ApiCaller, ApiResult } from '../composables/session'

export interface ReferenceDeps {
  api: ApiClient
}

export function defineReferenceStore(deps: ReferenceDeps) {
  return defineStore('reference', () => {
    const bookingRules = ref<BookingRules | null>(null)
    let loading: Promise<ApiResult<BookingRules>> | null = null

    // 已缓存直接返回；正在加载时共用同一个请求，避免首页与预约页同时进入时重复请求。
    function loadBookingRules(call: ApiCaller): Promise<ApiResult<BookingRules>> {
      if (bookingRules.value !== null) {
        return Promise.resolve({ ok: true, value: bookingRules.value })
      }
      loading ??= call(() => deps.api.getBookingRules()).then((result) => {
        loading = null
        if (result.ok) {
          bookingRules.value = result.value
        }
        return result
      })
      return loading
    }

    return { bookingRules, loadBookingRules }
  })
}

export const useReferenceStore = defineReferenceStore({ api })

export type ReferenceStore = ReturnType<typeof useReferenceStore>
