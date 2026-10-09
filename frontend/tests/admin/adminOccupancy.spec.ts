// FE-5 P5：场地占用总览。种子里 zhangsan 在明天 08:00 预订了网球场1，lisi 在明天 09:30 预订了网球场2。
import { describe, expect, it } from 'vitest'

import { createAdminOccupancy } from '../../src/composables/adminOccupancy'
import { RESOURCE_STATUS_LABELS, statusActionsFor } from '../../src/utils/adminResourceDisplay'
import { toneForResourceStatus } from '../../src/utils/statusTone'
import { loginAdmin, spyOn, TOMORROW } from './harness'

async function openBoard(username = 'admin_tennis', venueId = 1) {
  const ctx = await loginAdmin(username)
  const spy = spyOn(ctx.api)
  const board = createAdminOccupancy({ api: spy.client, call: ctx.call }, venueId, TOMORROW)
  await board.load()
  return { ctx, board, calls: spy.calls }
}

describe('P5 网格', () => {
  it('用所选场馆与日期调用 adminGetOccupancy', async () => {
    const { calls } = await openBoard()

    expect(calls).toEqual([{ method: 'adminGetOccupancy', args: [1, TOMORROW] }])
  })

  it('行是场地（按接口顺序网球场1…4），列是时段，格子有状态与预约人', async () => {
    const { board } = await openBoard()
    const grid = board.grid.value

    expect(grid?.rows.map((row) => row.resourceName)).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
    expect(grid?.columns[0]).toEqual({ startTime: '08:00', timeText: '08:00–09:30' })
    const first = grid?.rows[0]?.cells[0]
    expect(first).toMatchObject({
      status: 'BOOKED', statusLabel: '已被预约', tone: 'neutral',
      reservation: { userDisplayName: '张三', statusLabel: '待使用', tone: 'success' },
    })
    expect(grid?.rows[1]?.cells.find((cell) => cell?.startTime === '09:30')?.reservation?.userDisplayName).toBe('李四')
    const free = grid?.rows[2]?.cells[0]
    expect(free).toMatchObject({ status: 'AVAILABLE', statusLabel: '可预约', tone: 'success', reservation: null })
  })

  it('所有格子的状态文案和色调都来自 SlotStatus 的映射', async () => {
    const { board } = await openBoard()
    const cells = board.grid.value?.rows.flatMap((row) => row.cells) ?? []

    expect(new Set(cells.map((cell) => `${cell?.status}:${cell?.statusLabel}:${cell?.tone}`))).toEqual(
      new Set(['BOOKED:已被预约:neutral', 'AVAILABLE:可预约:success']),
    )
  })

  it('已停用的场地也显示（A7），整行不开放，带“已停用”标记', async () => {
    const { ctx, board } = await openBoard()
    await ctx.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    await board.load()

    const row = board.grid.value?.rows.find((item) => item.resourceName === '网球场4')
    expect(row).toMatchObject({ statusLabel: '已停用', statusTone: 'neutral' })
    expect(new Set(row?.cells.map((cell) => `${cell?.status}:${cell?.statusLabel}:${cell?.tone}`))).toEqual(new Set(['CLOSED:不开放:neutral']))
  })

  it('改日期会重新取数；清空日期不发请求', async () => {
    const { board, calls } = await openBoard()
    await board.setDate('2026-10-14')
    await board.setDate('')

    expect(board.date.value).toBe('2026-10-14')
    expect(calls.map((call) => call.args[1])).toEqual([TOMORROW, '2026-10-14'])
    expect(board.occupancy.value?.date).toBe('2026-10-14')
  })

  it('越权场馆：显示 FORBIDDEN_SCOPE 文案', async () => {
    const { board } = await openBoard('admin_tennis', 2)

    expect(board.error.value).toBe('无权操作该场馆')
    expect(board.grid.value).toBeNull()
  })
})

describe('docs/17 第 6 节 ResourceStatus 行（经 statusTone）', () => {
  it('OPEN success、MAINTENANCE danger、DISABLED neutral；中文名 开放 / 维护中 / 已停用', () => {
    expect(toneForResourceStatus('OPEN')).toBe('success')
    expect(toneForResourceStatus('MAINTENANCE')).toBe('danger')
    expect(toneForResourceStatus('DISABLED')).toBe('neutral')
    expect(Object.values(RESOURCE_STATUS_LABELS)).toEqual(['开放', '维护中', '已停用'])
  })

  it('Q2：状态按钮按 docs/03 第 6 节状态图', () => {
    expect(statusActionsFor('OPEN').map((action) => [action.label, action.target])).toEqual([['设为维护', 'MAINTENANCE'], ['停用', 'DISABLED']])
    expect(statusActionsFor('MAINTENANCE').map((action) => [action.label, action.target])).toEqual([['恢复开放', 'OPEN'], ['停用', 'DISABLED']])
    expect(statusActionsFor('DISABLED').map((action) => [action.label, action.target])).toEqual([['重新启用', 'OPEN']])
  })
})
