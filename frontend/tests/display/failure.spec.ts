// 大屏拉取失败（FE-7-rulings T3、T4）：有旧数据时保留旧数据并提示，没有数据时显示错误状态，下一轮恢复后提示消失。
import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { DisplaySummary } from '../../src/api/typesSection5'
import { useDisplayBoard } from '../../src/composables/displayPolling'
import { presentBoard } from '../../src/utils/displayModel'
import { messageFor } from '../../src/utils/errorMessages'
import { createManualScheduler, makeSummary, settle } from './support'

type Outcome = DisplaySummary | Error

function start(outcomes: Outcome[]) {
  const scheduler = createManualScheduler()
  let count = 0
  const fetchSummary = () => {
    const outcome = outcomes[Math.min(count, outcomes.length - 1)]
    count += 1
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome ?? makeSummary())
  }
  const state = effectScope().run(() => useDisplayBoard({ fetchSummary, scheduler }))
  if (state === undefined) {
    throw new Error('effectScope 没有运行')
  }
  return { scheduler, board: () => presentBoard(state.value) }
}

const OLD = makeSummary({ generatedAt: '2026-10-12T07:00:00', todayReservationCount: 7 })
const NEW = makeSummary({ generatedAt: '2026-10-12T07:01:00', todayReservationCount: 9 })
const FAILURE = new ApiError(500, 'INTERNAL_ERROR', '服务端出错')

describe('已有旧数据时拉取失败', () => {
  it('保留旧数据，并提示失败原因与旧数据的生成时间', async () => {
    const { scheduler, board } = start([OLD, FAILURE])
    await settle()
    scheduler.tick()
    await settle()
    const shown = board()
    if (shown.kind !== 'ready') {
      throw new Error(`期望 ready，实际 ${shown.kind}`)
    }
    expect(shown.staleNotice).toBe(`数据更新失败，${messageFor('INTERNAL_ERROR')}，显示的是 2026-10-12 07:00:00 的数据`)
    expect(shown.view.metrics[0]?.value).toBe('7')
    expect(shown.view.venues).toHaveLength(2)
  })

  it('下一轮拉取成功：提示消失，换成新数据', async () => {
    const { scheduler, board } = start([OLD, FAILURE, NEW])
    await settle()
    scheduler.tick()
    await settle()
    scheduler.tick()
    await settle()
    const shown = board()
    expect(shown).toMatchObject({ kind: 'ready', staleNotice: null })
    expect(shown.kind === 'ready' && shown.view.metrics[0]?.value).toBe('9')
  })

  it('连续失败仍显示最后一次成功的数据时间，不使用失败时刻', async () => {
    const { scheduler, board } = start([OLD, new Error('断网'), new Error('仍然断网')])
    await settle()
    for (let round = 0; round < 2; round += 1) {
      scheduler.tick()
      await settle()
    }
    expect(board()).toMatchObject({
      kind: 'ready',
      staleNotice: `数据更新失败，${messageFor('INTERNAL_ERROR')}，显示的是 2026-10-12 07:00:00 的数据`,
    })
  })
})

describe('尚无任何数据时拉取失败', () => {
  it('首次拉取失败：显示错误状态（含错误码对应的中文文案），不显示数据', async () => {
    const { board } = start([new ApiError(503, 'INTERNAL_ERROR', '不可用')])
    expect(board()).toEqual({ kind: 'loading' })
    await settle()
    expect(board()).toEqual({ kind: 'error', message: `数据加载失败，${messageFor('INTERNAL_ERROR')}，系统会自动重试` })
  })

  it('下一轮照常重试，成功后进入正常显示且没有提示', async () => {
    const { scheduler, board } = start([FAILURE, FAILURE, NEW])
    await settle()
    scheduler.tick()
    await settle()
    expect(board().kind).toBe('error')
    scheduler.tick()
    await settle()
    expect(board()).toMatchObject({ kind: 'ready', staleNotice: null })
  })

  it('不是 ApiError 的异常按 INTERNAL_ERROR 文案显示', async () => {
    const { board } = start([new TypeError('Failed to fetch')])
    await settle()
    expect(board()).toMatchObject({ kind: 'error', message: expect.stringContaining(messageFor('INTERNAL_ERROR')) })
  })
})

describe('公开页不处理登录失效（T4）', () => {
  it('TOKEN_EXPIRED 只当作普通失败显示文案，不会触发回登录页等副作用', async () => {
    const { board } = start([new ApiError(401, 'TOKEN_EXPIRED', '过期')])
    await settle()
    expect(board()).toEqual({ kind: 'error', message: `数据加载失败，${messageFor('TOKEN_EXPIRED')}，系统会自动重试` })
  })
})
