// 订场“确认预约”步骤的同行人名单（P2-2c 裁决第 1 节、第 5 节）：精确查找（GET /users/lookup）后加入名单，
// 可逐个移除，至多 6 位；提交时按添加顺序给出 companionUserIds。名单保留到预约成功、“继续订场”或离开订场页。
// 只保存查找返回的 Companion（id 与姓名），不保存、不显示查找输入以外的任何个人信息。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { Companion, UserProfile } from '../api/types'
import { COMPANION_TEXTS, MAX_COMPANIONS } from '../utils/companionDisplay'
import type { ApiCaller, ApiResult } from './session'

export type SelfIdentity = Pick<UserProfile, 'username' | 'phone'>

export interface CompanionDeps {
  api: ApiClient
  call: ApiCaller
  self?: () => SelfIdentity | null   // 当前用户；用于“不能添加自己”的提示（不发请求）
}

function isSelf(text: string, self: SelfIdentity | null): boolean {
  return self !== null && (text === self.username || (self.phone !== null && text === self.phone))
}

export function createBookingCompanions(deps: CompanionDeps) {
  const list = ref<Companion[]>([])
  const text = ref('')
  const looking = ref(false)
  const notice = ref<string | null>(null)
  const full = computed(() => list.value.length >= MAX_COMPANIONS)

  // 输入框内容；改动即清除上一次的提示。
  const query = computed({
    get: () => text.value,
    set: (value: string) => {
      if (value !== text.value) {
        text.value = value
        notice.value = null
      }
    },
  })

  // 发送前去掉首尾空白，空白不发请求；进行中或已满时不再查找。找到并加入名单时返回 true。
  async function lookup(): Promise<boolean> {
    const q = query.value.trim()
    if (looking.value || full.value || q === '') {
      return false
    }
    if (isSelf(q, deps.self?.() ?? null)) {
      notice.value = COMPANION_TEXTS.self
      return false
    }
    looking.value = true
    notice.value = null
    const outcome = await deps.call(() => deps.api.lookupUser(q))
    looking.value = false
    return accept(outcome, q)
  }

  // 查找结果：NOT_FOUND 显示“未找到该用户”，其他错误显示错误码文案；同一人不重复加入。
  // 加入后，若输入框仍是刚才查找的内容就清空。
  function accept(outcome: ApiResult<Companion>, q: string): boolean {
    if (!outcome.ok) {
      if (!outcome.sessionEnded) {
        notice.value = outcome.code === 'NOT_FOUND' ? COMPANION_TEXTS.notFound : outcome.message
      }
      return false
    }
    const found = outcome.value
    if (list.value.some((companion) => companion.userId === found.userId)) {
      notice.value = COMPANION_TEXTS.duplicate
      return false
    }
    if (full.value) {
      return false
    }
    list.value = [...list.value, { userId: found.userId, displayName: found.displayName }]
    if (query.value.trim() === q) {
      query.value = ''
    }
    return true
  }

  function remove(userId: number): void {
    list.value = list.value.filter((companion) => companion.userId !== userId)
  }

  // 按添加顺序。
  function ids(): number[] {
    return list.value.map((companion) => companion.userId)
  }

  function clear(): void {
    list.value = []
    text.value = ''
    notice.value = null
  }

  return { list, query, looking, notice, full, lookup, remove, ids, clear }
}

export type BookingCompanions = ReturnType<typeof createBookingCompanions>
