// FE-8 L4（FE-4 N-4）：BookingRules 取不到时，在已选场馆内就地重试；成功后补出日期并加载时段。
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { createBookingBoard } from '../../src/composables/bookingBoard'
import { defineReferenceStore } from '../../src/stores/reference'
import { loginAs } from '../reservations/harness'
import { TODAY } from './harness'

// 规则接口坏着：load 与 selectVenue 各取一次都失败；把 broken 改成 false 后重试才成功。
async function brokenRulesBoard() {
  const ctx = await loginAs('zhangsan', '/booking')
  const state = { broken: true, rulesCalls: 0, slotDates: [] as string[] }
  const api: ApiClient = {
    ...ctx.h.api,
    getBookingRules: () => {
      state.rulesCalls += 1
      return state.broken ? Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) : ctx.h.api.getBookingRules()
    },
    getVenueSlots: (venueId, date) => { state.slotDates.push(date); return ctx.h.api.getVenueSlots(venueId, date) },
  }
  const board = createBookingBoard({
    api, call: ctx.call, reference: defineReferenceStore({ api })(createPinia()), today: () => TODAY,
  })
  await board.load()
  await board.selectVenue(1)
  return { board, state }
}

describe('FE-8 L4 BookingRules 取不到时就地重试', () => {
  it('重试成功：补出日期选项（从今天起 advanceDays 个）、选中第一个并加载时段，错误文案清除', async () => {
    const { board, state } = await brokenRulesBoard()
    expect(board.dates.value).toEqual([])
    expect(board.rulesError.value).toBe('服务器开小差了，请稍后再试')
    expect(state.slotDates).toEqual([])

    state.broken = false
    await board.retryRules()

    expect(board.rulesError.value).toBeNull()
    expect(board.dates.value).toHaveLength(7)
    expect(board.dates.value[0]?.value).toBe(TODAY)
    expect(board.date.value).toBe(TODAY)
    expect(state.slotDates).toEqual([TODAY])
    expect(board.slotsPhase.value).toBe('ready')
    expect(board.groups.value.length).toBeGreaterThan(0)
  })

  it('重试仍失败：仍没有日期、仍显示文案，也不请求时段', async () => {
    const { board, state } = await brokenRulesBoard()
    const before = state.rulesCalls

    await board.retryRules()

    expect(state.rulesCalls).toBe(before + 1)
    expect(board.dates.value).toEqual([])
    expect(board.date.value).toBeNull()
    expect(board.rulesError.value).toBe('服务器开小差了，请稍后再试')
    expect(state.slotDates).toEqual([])
  })

  it('没有选定场馆时重试什么也不做', async () => {
    const { board, state } = await brokenRulesBoard()
    board.backToVenues()
    const before = state.rulesCalls

    await board.retryRules()

    expect(state.rulesCalls).toBe(before)
  })

  it('重试期间已返回场馆列表：放弃结果，不补日期也不请求时段', async () => {
    const { board, state } = await brokenRulesBoard()
    state.broken = false

    const pending = board.retryRules()
    board.backToVenues()
    await pending

    expect(board.dates.value).toEqual([])
    expect(board.date.value).toBeNull()
    expect(state.slotDates).toEqual([])
  })
})
