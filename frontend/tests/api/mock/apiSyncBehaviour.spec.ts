// API-SYNC 台账（docs/evidence/ACC-M3-12.md）中 mock 以后端为准的行为：
// S-042 空白原因存 null、S-045 设定场地数量的边界、S-046 场馆存在性检查的阶段、S-047 新建类日志的 before、S-048 大屏场地顺序。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, TOMORROW, type Harness } from '../support/harness'

async function as(username: string): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('S-042 影响检查中的空白 reason 存 null', () => {
  it('新增特殊关闭：关闭规则与日志的 reason 都是 null', async () => {
    const h = await as('sysadmin')
    const added = await h.api.adminAddClosure(1, {
      startDate: TOMORROW, endDate: TOMORROW, reason: '   ', onExistingReservations: 'KEEP',
    })
    expect(added.data?.reason).toBeNull()
    expect((await h.api.adminGetAvailabilityRules(1)).closures[0]?.reason).toBeNull()
    expect((await h.api.adminListLogs({ action: 'CLOSURE_ADD' })).items[0]?.reason).toBeNull()
  })
})

describe('S-045 设定场地数量的边界输入', () => {
  it('生成的场地名超过 50 个字符 → VALIDATION_ERROR fields.namePrefix', async () => {
    const h = await as('sysadmin')
    await h.api.adminUpdateResource(4, { name: `网球场${'9'.repeat(47)}` })
    await expectApiError(h.api.adminSetResourceCount(1, { count: 5 }), 'VALIDATION_ERROR',
      { fields: { namePrefix: '生成的场地名超过 50 个字符' } })
  })

  it('排序值超出 INTEGER → VALIDATION_ERROR fields.count', async () => {
    const h = await as('sysadmin')
    await h.api.adminUpdateResource(4, { sortOrder: 2147483647 })
    await expectApiError(h.api.adminSetResourceCount(1, { count: 5 }), 'VALIDATION_ERROR',
      { fields: { count: '排序值已达上限，无法追加场地' } })
  })

  it('编号超过 2^53 时仍精确：下一个编号为最大编号 + 1', async () => {
    const h = await as('sysadmin')
    await h.api.adminUpdateResource(4, { name: '网球场9007199254740993' })
    const result = await h.api.adminSetResourceCount(1, { count: 5 })
    expect(result.data?.map((resource) => resource.name)).toContain('网球场9007199254740994')
  })
})

describe('S-046 venueIds 中的场馆是否存在，在角色与用户名检查之后才查', () => {
  const NEW_ADMIN = { username: 'admin_new', password: 'Passw0rd!', displayName: '新管理员', role: 'VENUE_ADMIN' as const }

  it('场馆管理员创建账号：先得 FORBIDDEN，而不是 VALIDATION_ERROR', async () => {
    const h = await as('admin_tennis')
    await expectApiError(h.api.adminCreateUser({ ...NEW_ADMIN, venueIds: [999] }), 'FORBIDDEN')
  })

  it('用户名已占用：先得 USERNAME_TAKEN；用户名可用时才报场馆不存在', async () => {
    const h = await as('sysadmin')
    await expectApiError(h.api.adminCreateUser({ ...NEW_ADMIN, username: 'zhangsan', venueIds: [999] }), 'USERNAME_TAKEN')
    await expectApiError(h.api.adminCreateUser({ ...NEW_ADMIN, venueIds: [999] }), 'VALIDATION_ERROR',
      { fields: { venueIds: '应为已存在场馆 id 组成的数组' } })
  })

  it('整体替换授权：目标不是 VENUE_ADMIN 的 INVALID_STATE 先于场馆不存在', async () => {
    const h = await as('sysadmin')
    await expectApiError(h.api.adminSetVenueScope(1, { venueIds: [999] }), 'INVALID_STATE', { status: 'USER' })
    await expectApiError(h.api.adminSetVenueScope(5, { venueIds: [999] }), 'VALIDATION_ERROR',
      { fields: { venueIds: '应为已存在场馆 id 组成的数组' } })
  })
})

describe('S-047 新建类日志的 before 与其他动作同形', () => {
  const EMPTY_BEFORE = { object: null, affectedReservationIds: [] }

  it('ANNOUNCEMENT_PUBLISH 与 USER_CREATE 的 before 为 {object: null, affectedReservationIds: []}', async () => {
    const h = await as('sysadmin')
    await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: '通知', content: '内容' })
    await h.api.adminCreateUser({ username: 'teacher01', password: 'Passw0rd!', displayName: '体育老师', role: 'USER' })
    expect((await h.api.adminListLogs({ action: 'ANNOUNCEMENT_PUBLISH' })).items[0]?.before).toEqual(EMPTY_BEFORE)
    expect((await h.api.adminListLogs({ action: 'USER_CREATE' })).items[0]?.before).toEqual(EMPTY_BEFORE)
  })
})

describe('S-048 大屏 resources 按场馆 id、sortOrder、id 排序', () => {
  it('改过 sortOrder 后按 sortOrder 排列，而不是按数组顺序', async () => {
    const h = await as('sysadmin')
    await h.api.adminUpdateResource(1, { sortOrder: 99 })
    const summary = await h.api.getDisplaySummary()
    expect(summary.resources.filter((resource) => resource.venueId === 1).map((resource) => resource.resourceId))
      .toEqual([2, 3, 4, 1])
  })
})
