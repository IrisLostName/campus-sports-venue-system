// P2-1c：扫码提交（composables/adminCheckIn）——调用 POST /admin/check-ins、经 ApiCaller（登录失效不记录结果）、
// 业务错误保留 details 供结果说明、进行中不重复提交、最近记录至多 10 条；源码里不再有用户自助签到。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { createAdminCheckIn, HISTORY_LIMIT } from '../../src/composables/adminCheckIn'
import type { ApiCaller } from '../../src/composables/session'
import { describeError } from '../../src/utils/errorText'
import { isSessionFailure } from '../../src/utils/sessionErrors'

const ADMIN_RESERVATION = {
  id: 1, venueId: 1, venueName: '网球馆', resourceId: 1, resourceName: '网球场1', userId: 1, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'IN_USE',
  purpose: null, createdAt: '2026-10-12T07:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null, adminNote: null,
  checkInAt: '2026-10-13T07:50:12', checkOutAt: null, userUsername: 'zhangsan', userPhone: null,
} as const

// 与 callApi 相同的形状；登录失效类错误记为 sessionEnded。
const call: ApiCaller = async (request) => {
  try {
    return { ok: true, value: await request() }
  } catch (error) {
    const sessionEnded = error instanceof ApiError && isSessionFailure(error.code)
    return { ok: false, ...describeError(error), sessionEnded }
  }
}

function withApi(adminCheckIn: ApiClient['adminCheckIn']) {
  const codes: string[] = []
  const api = { adminCheckIn: (request: { code: string }) => { codes.push(request.code); return adminCheckIn(request) } } as unknown as ApiClient
  return { board: createAdminCheckIn({ api, call, clock: () => '2026-10-13T07:50:12' }), codes }
}

describe('提交', () => {
  it('去掉首尾空白后提交；成功记录“签到成功”', async () => {
    const { board, codes } = withApi(() => Promise.resolve(ADMIN_RESERVATION))
    expect(await board.submit('  abc.1  ')).toBe(true)

    expect(codes).toEqual(['abc.1'])
    expect(board.outcome.value).toMatchObject({ ok: true, title: '签到成功' })
    expect(board.history.value).toEqual([
      { seq: 1, time: '07:50:12', ok: true, title: '签到成功', summary: '张三（zhangsan） · 网球馆 · 网球场1 · 2026-10-13 周二 08:00–09:30' },
    ])
  })

  it('业务错误保留 details：CHECKIN_WINDOW_CLOSED 显示开放时间', async () => {
    const { board } = withApi(() => Promise.reject(new ApiError(409, 'CHECKIN_WINDOW_CLOSED', 'x', {
      opensAt: '2026-10-13T07:45:00', closesAt: '2026-10-13T08:15:00',
    })))
    await board.submit('abc.1')

    expect(board.outcome.value).toMatchObject({ ok: false, title: '当前不在签到时间内', detail: '该预约的签到时间为 2026-10-13 07:45–08:15。' })
  })

  it('登录失效：交给 ApiCaller（回登录页），不记录结果', async () => {
    const { board } = withApi(() => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')))
    await board.submit('abc.1')

    expect(board.outcome.value).toBeNull()
    expect(board.history.value).toEqual([])
    expect(board.busy.value).toBe(false)
  })

  it('网络等非业务错误：按 INTERNAL_ERROR 文案显示', async () => {
    const { board } = withApi(() => Promise.reject(new Error('offline')))
    await board.submit('abc.1')

    expect(board.outcome.value).toMatchObject({ ok: false, title: '服务器开小差了，请稍后再试' })
  })

  it('空白不提交；进行中不重复提交', async () => {
    let release: () => void = () => undefined
    const { board, codes } = withApi(() => new Promise((resolve) => { release = () => resolve(ADMIN_RESERVATION) }))
    expect(await board.submit('   ')).toBe(false)

    const first = board.submit('a.1')
    expect(board.busy.value).toBe(true)
    expect(await board.submit('b.2')).toBe(false)
    release()
    await first
    expect(codes).toEqual(['a.1'])
  })

  it(`最近记录新的在前，至多 ${HISTORY_LIMIT} 条`, async () => {
    const { board } = withApi(() => Promise.reject(new ApiError(400, 'CHECKIN_CODE_INVALID', 'x')))
    for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) {
      await board.submit(`c.${index + 1}`)
    }
    expect(board.history.value).toHaveLength(HISTORY_LIMIT)
    expect(board.history.value.map((entry) => entry.seq)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4])
  })
})

describe('源码：用户自助签到已删除（契约 v1.1）', () => {
  const SRC = fileURLToPath(new URL('../../src/', import.meta.url))
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|vue)$/.test(name) ? [path] : []
  })

  it('src 中没有 /reservations/{id}/check-in 自助签到路径，也没有 checkIn( 调用', () => {
    const offenders = walk(SRC).filter((path) => {
      const text = readFileSync(path, 'utf8')
      return /reservations\/[^'"`]*\/check-in[`'"]/.test(text) || /\bcheckIn\(/.test(text)
    })
    expect(offenders).toEqual([])
  })
})
