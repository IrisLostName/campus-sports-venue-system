// FE-5 P8：操作记录。LogAction / LogTargetType 的中文名是施工拟定（FE-5 裁决 Q12 认可），这里逐条钉住。
import { describe, expect, it } from 'vitest'

import type { LogAction, LogTargetType } from '../../src/api/types'
import { createAdminLogs } from '../../src/composables/adminLogs'
import { buildLogRow, formatJson, LOG_ACTION_LABELS, LOG_ACTION_OPTIONS, LOG_TARGET_LABELS } from '../../src/utils/adminLogDisplay'
import { loginAdmin, spyOn, type AdminContext } from './harness'

describe('P8 中文名', () => {
  it('十五个动作逐条对应', () => {
    expect(LOG_ACTION_LABELS).toEqual({
      RESERVATION_CANCEL: '取消预约',
      RESERVATION_REASSIGN_RESOURCE: '改派场地',
      RESERVATION_REASSIGN_USER: '改派预约人',
      RESOURCE_STATUS_CHANGE: '变更场地状态',
      RESOURCE_COUNT_CHANGE: '调整场地数量',
      VENUE_UPDATE: '修改场馆资料',
      RULE_WEEKLY_UPDATE: '修改每周开放窗口',
      CLOSURE_ADD: '新增特殊关闭',
      CLOSURE_REMOVE: '移除特殊关闭',
      SCOPE_UPDATE: '调整授权范围',
      USER_CREATE: '创建账号',
      USER_STATUS_CHANGE: '变更账号状态',
      ANNOUNCEMENT_PUBLISH: '发布公告',
      ANNOUNCEMENT_ARCHIVE: '归档公告',
      REPAIR_UPDATE: '更新报修',
    } satisfies Record<LogAction, string>)
    expect(LOG_ACTION_OPTIONS).toHaveLength(15)
    expect(new Set(Object.values(LOG_ACTION_LABELS)).size).toBe(15)
  })

  it('八个对象类型逐条对应', () => {
    expect(LOG_TARGET_LABELS).toEqual({
      RESERVATION: '预约', RESOURCE: '场地', VENUE: '场馆', RULE: '开放规则',
      USER: '用户', SCOPE: '授权范围', ANNOUNCEMENT: '公告', REPAIR: '报修',
    } satisfies Record<LogTargetType, string>)
  })

  it('formatJson 缩进两格；null 没有内容', () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(formatJson(null)).toBeNull()
  })

  it('buildLogRow：对象带编号，空原因为 null，targetId 为 null 时只显示类型', () => {
    const base = {
      id: 1, adminId: 2, adminName: '网球馆管理员', venueId: 1, action: 'RULE_WEEKLY_UPDATE' as const,
      targetType: 'RULE' as const, targetId: null, reason: '  ', before: null, after: [1], createdAt: '2026-10-12T09:00:30',
    }

    expect(buildLogRow(base)).toEqual({
      id: 1, timeText: '2026-10-12 09:00', adminName: '网球馆管理员', actionLabel: '修改每周开放窗口',
      targetText: '开放规则', reasonText: null, before: null, after: '[\n  1\n]',
    })
    expect(buildLogRow({ ...base, targetId: 7, reason: '检修' })).toMatchObject({ targetText: '开放规则 #7', reasonText: '检修' })
  })
})

async function withLogs(): Promise<AdminContext> {
  const ctx = await loginAdmin('admin_tennis')
  await ctx.api.adminCancelReservation(1, { reason: '场地维修' })
  await ctx.api.adminUpdateResource(4, { operationalStatus: 'MAINTENANCE' })
  return ctx
}

describe('P8 board', () => {
  it('所选场馆的记录按时间倒序（同刻按 id 倒序），显示动作、对象、原因、前后快照', async () => {
    const ctx = await withLogs()
    const spy = spyOn(ctx.api)
    const logs = createAdminLogs({ api: spy.client, call: ctx.call }, 1)
    await logs.load()

    expect(spy.calls).toEqual([{ method: 'adminListLogs', args: [{ venueId: 1, page: 1 }] }])
    expect(logs.rows.value.map((row) => [row.actionLabel, row.targetText, row.reasonText, row.adminName])).toEqual([
      ['变更场地状态', '场地 #4', null, '网球馆管理员'],
      ['取消预约', '预约 #1', '场地维修', '网球馆管理员'],
    ])
    expect(logs.rows.value[1]?.before).toContain('"status": "CONFIRMED"')
    expect(logs.rows.value[1]?.after).toContain('"status": "ADMIN_CANCELLED"')
    expect(logs.list.total.value).toBe(2)
  })

  it('按动作与日期区间筛选，从第一页重新查询', async () => {
    const ctx = await withLogs()
    const spy = spyOn(ctx.api)
    const logs = createAdminLogs({ api: spy.client, call: ctx.call }, 1)
    await logs.load()
    logs.filters.action = 'RESERVATION_CANCEL'
    await logs.search()

    expect(spy.calls[1]?.args).toEqual([{ venueId: 1, page: 1, action: 'RESERVATION_CANCEL' }])
    expect(logs.rows.value.map((row) => row.actionLabel)).toEqual(['取消预约'])

    logs.filters.action = ''
    logs.filters.dateFrom = '2026-10-13'
    await logs.search()
    expect(spy.calls[2]?.args).toEqual([{ venueId: 1, page: 1, dateFrom: '2026-10-13' }])
    expect(logs.rows.value).toEqual([])

    logs.filters.dateFrom = '2026-10-12'
    logs.filters.dateTo = '2026-10-12'
    await logs.search()
    expect(spy.calls[3]?.args).toEqual([{ venueId: 1, page: 1, dateFrom: '2026-10-12', dateTo: '2026-10-12' }])
    expect(logs.rows.value).toHaveLength(2)
  })

  it('越权场馆：显示 FORBIDDEN_SCOPE 文案', async () => {
    const ctx = await loginAdmin('admin_tennis')
    const logs = createAdminLogs({ api: ctx.api, call: ctx.call }, 2)
    await logs.load()

    expect(logs.list.error.value).toBe('无权操作该场馆')
    expect(logs.rows.value).toEqual([])
  })
})
