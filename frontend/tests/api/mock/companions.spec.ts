// v1.2 同行人名单（P2-2c 裁决第 0 节第 2 条、第 3 节）：mock 的查找（GET /users/lookup）、创建时的格式与业务两步、
// 人员改派移除新预约人、同行人看不到该预约且不占用自己的名额。阶段顺序与 P2-2b 后端一致。
// 种子用户：1 zhangsan、2 lisi、3 wangwu、4 zhaoliu（USER），5 admin_tennis、6 admin_pool（VA），7 sysadmin（SA）。
import { describe, expect, it } from 'vitest'

import type { UserRecord } from '../../../src/api/mock/state'
import type { CreateReservationRequest } from '../../../src/api/requests'
import { createHarness, expectApiError, type Harness, TOMORROW } from '../support/harness'

async function asUser(username = 'zhangsan'): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

// 直接往 mock 状态里加一个用户（种子里没有手机号，也只有 4 个普通用户）。
function addUser(h: Harness, fields: Partial<UserRecord> & Pick<UserRecord, 'username' | 'displayName'>): UserRecord {
  const id = Math.max(...h.context.state.users.map((user) => user.id)) + 1
  const record: UserRecord = {
    id, password: 'unused', role: 'USER', userType: 'STUDENT', phone: null, status: 'ACTIVE', checkInUuid: `uuid-${id}`,
    passwordChangedAt: null, ...fields,
  }
  h.context.state.users.push(record)
  return record
}

function setPhone(h: Harness, username: string, phone: string): void {
  const user = h.context.state.users.find((candidate) => candidate.username === username)
  if (user === undefined) {
    throw new Error(username)
  }
  user.phone = phone
}

const SLOT: CreateReservationRequest = { resourceId: 3, serviceDate: TOMORROW, startTime: '11:00' }

describe('查找同行人：精确匹配，只返回 userId 与 displayName', () => {
  it('按用户名：返回体只有两个字段', async () => {
    const h = await asUser()
    const found = await h.api.lookupUser('lisi')
    expect(found).toEqual({ userId: 2, displayName: '李四' })
    expect(Object.keys(found).sort()).toEqual(['displayName', 'userId'])
  })

  it('按手机号；用户名优先于手机号', async () => {
    const h = await asUser()
    setPhone(h, 'wangwu', '13800000001')
    setPhone(h, 'zhaoliu', 'lisi')
    await expect(h.api.lookupUser('13800000001')).resolves.toEqual({ userId: 3, displayName: '王五' })
    await expect(h.api.lookupUser('lisi')).resolves.toEqual({ userId: 2, displayName: '李四' })
  })

  it('不是模糊匹配，也不去首尾空白、不忽略大小写', async () => {
    const h = await asUser()
    await expectApiError(h.api.lookupUser('lis'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser(' lisi'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser('LISI'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser('李四'), 'NOT_FOUND')
  })

  it('手机号多人合格匹配 → NOT_FOUND；不合格的不算', async () => {
    const h = await asUser()
    setPhone(h, 'wangwu', '13900000000')
    setPhone(h, 'zhaoliu', '13900000000')
    await expectApiError(h.api.lookupUser('13900000000'), 'NOT_FOUND')
    h.context.state.users.find((user) => user.username === 'zhaoliu')!.status = 'DISABLED'
    await expect(h.api.lookupUser('13900000000')).resolves.toEqual({ userId: 3, displayName: '王五' })
  })

  it('用户名命中不合格用户时继续按手机号匹配', async () => {
    const h = await asUser()
    addUser(h, { username: 'ghost', displayName: '停用者', status: 'DISABLED' })
    setPhone(h, 'wangwu', 'ghost')
    await expect(h.api.lookupUser('ghost')).resolves.toEqual({ userId: 3, displayName: '王五' })
  })

  it('停用用户、管理员账号、本人 → NOT_FOUND', async () => {
    const h = await asUser()
    addUser(h, { username: 'off', displayName: '停用', status: 'DISABLED' })
    await expectApiError(h.api.lookupUser('off'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser('admin_tennis'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser('sysadmin'), 'NOT_FOUND')
    await expectApiError(h.api.lookupUser('zhangsan'), 'NOT_FOUND')
  })

  it('q 空白或超过 32 → VALIDATION_ERROR（fields.q）；恰好 32 可以查', async () => {
    const h = await asUser()
    await expectApiError(h.api.lookupUser('   '), 'VALIDATION_ERROR', { fields: { q: '不能为空' } })
    await expectApiError(h.api.lookupUser(''), 'VALIDATION_ERROR', { fields: { q: '不能为空' } })
    await expectApiError(h.api.lookupUser('x'.repeat(33)), 'VALIDATION_ERROR', { fields: { q: '长度不能超过 32' } })
    await expectApiError(h.api.lookupUser('x'.repeat(32)), 'NOT_FOUND')
  })

  it('阶段顺序：认证 → 格式 → 角色（VA、SA 为 FORBIDDEN）', async () => {
    await expectApiError(createHarness().api.lookupUser('lisi'), 'AUTH_REQUIRED')
    const va = await asUser('admin_tennis')
    await expectApiError(va.api.lookupUser(' '), 'VALIDATION_ERROR')
    await expectApiError(va.api.lookupUser('lisi'), 'FORBIDDEN')
    const sa = await asUser('sysadmin')
    await expectApiError(sa.api.lookupUser('lisi'), 'FORBIDDEN')
  })
})

describe('创建预约：companionUserIds', () => {
  it('没有该字段、null 或空数组：companions 为空数组', async () => {
    const h = await asUser('wangwu')
    await expect(h.api.createReservation(SLOT)).resolves.toMatchObject({ companions: [] })
    const nulled = { ...SLOT, startTime: '12:30', companionUserIds: null } as unknown as CreateReservationRequest
    await expect(h.api.createReservation(nulled)).resolves.toMatchObject({ companions: [] })
    await expect(h.api.createReservation({ ...SLOT, startTime: '14:00', companionUserIds: [] })).resolves.toMatchObject({ companions: [] })
  })

  it('按提交顺序保存并返回；6 位可以', async () => {
    const h = await asUser()
    const extra = [addUser(h, { username: 'u5', displayName: '周八' }), addUser(h, { username: 'u6', displayName: '吴九' }),
      addUser(h, { username: 'u7', displayName: '郑十' })]
    const ids = [4, 2, extra[0]!.id, 3, extra[1]!.id, extra[2]!.id]
    const created = await h.api.createReservation({ ...SLOT, companionUserIds: ids })
    expect(created.companions.map((companion) => companion.userId)).toEqual(ids)
    expect(created.companions.map((companion) => companion.displayName)).toEqual(['赵六', '李四', '周八', '王五', '吴九', '郑十'])
    expect((await h.api.getReservation(created.id)).companions).toEqual(created.companions)
  })

  it.each([
    ['7 位', [2, 3, 4, 8, 9, 10, 11]],
    ['重复 id', [2, 2]],
    ['包含本人', [2, 1]],
    ['0', [0]],
    ['负数', [-2]],
    ['小数', [2.5]],
    ['字符串', ['2']],
    ['null 元素', [null]],
  ] as const)('格式阶段：%s → VALIDATION_ERROR（fields.companionUserIds）', async (_name, ids) => {
    const h = await asUser()
    const request = { ...SLOT, companionUserIds: ids } as unknown as CreateReservationRequest
    await expectApiError(h.api.createReservation(request), 'VALIDATION_ERROR')
      .then((error) => expect(Object.keys((error.details?.fields ?? {}) as object)).toEqual(['companionUserIds']))
  })

  it('不是数组 → VALIDATION_ERROR（fields.companionUserIds）', async () => {
    const h = await asUser()
    const request = { ...SLOT, companionUserIds: 2 } as unknown as CreateReservationRequest
    const error = await expectApiError(h.api.createReservation(request), 'VALIDATION_ERROR')
    expect(Object.keys((error.details?.fields ?? {}) as object)).toEqual(['companionUserIds'])
  })

  it.each([
    ['不存在的用户', 999],
    ['场馆管理员', 5],
    ['系统管理员', 7],
  ])('业务阶段（步骤 8a）：%s → VALIDATION_ERROR（fields.companionUserIds），不插入', async (_name, id) => {
    const h = await asUser()
    const before = h.context.state.reservations.length
    const error = await expectApiError(h.api.createReservation({ ...SLOT, companionUserIds: [2, id] }), 'VALIDATION_ERROR')
    expect(Object.keys((error.details?.fields ?? {}) as object)).toEqual(['companionUserIds'])
    expect(h.context.state.reservations).toHaveLength(before)
  })

  it('业务阶段：停用用户 → VALIDATION_ERROR', async () => {
    const h = await asUser()
    const off = addUser(h, { username: 'off', displayName: '停用', status: 'DISABLED' })
    await expectApiError(h.api.createReservation({ ...SLOT, companionUserIds: [off.id] }), 'VALIDATION_ERROR')
  })

  it('格式阶段在角色检查之前：管理员提交 7 位同行人 → VALIDATION_ERROR，不是 FORBIDDEN', async () => {
    const h = await asUser('admin_tennis')
    await expectApiError(h.api.createReservation({ ...SLOT, companionUserIds: [1, 2, 3, 4, 8, 9, 10] }), 'VALIDATION_ERROR')
    await expectApiError(h.api.createReservation({ ...SLOT, companionUserIds: [999] }), 'FORBIDDEN')
  })

  it('步骤 8a 在 SLOT_TAKEN、BOOKING_LIMIT_REACHED 之后', async () => {
    const h = await asUser()
    // 种子：zhangsan 明天 网球场1 08:00。
    await expectApiError(h.api.createReservation({ resourceId: 1, serviceDate: TOMORROW, startTime: '08:00', companionUserIds: [999] }), 'SLOT_TAKEN')
    await h.api.createReservation({ ...SLOT, startTime: '12:30' })
    await h.api.createReservation({ ...SLOT, startTime: '14:00' })
    await expectApiError(h.api.createReservation({ ...SLOT, companionUserIds: [999] }), 'BOOKING_LIMIT_REACHED')
  })
})

describe('同行人的视角与人员改派', () => {
  it('同行人的“我的预约”看不到该预约，按 id 取得 NOT_OWNER；不占用同行人的名额', async () => {
    const h = await asUser()
    const created = await h.api.createReservation({ ...SLOT, companionUserIds: [3] })
    const wangwu = await h.clientFor('wangwu')
    expect((await wangwu.listMyReservations()).items).toEqual([])
    await expectApiError(wangwu.getReservation(created.id), 'NOT_OWNER')
    for (const startTime of ['08:00', '09:30', '11:00']) {
      await wangwu.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime })
    }
    expect((await wangwu.listMyReservations({ scope: 'CURRENT' })).total).toBe(3)
  })

  it('管理端列表与扫码签到返回体都带 companions', async () => {
    const h = await asUser()
    const created = await h.api.createReservation({ ...SLOT, companionUserIds: [2, 4] })
    const admin = await h.clientFor('admin_tennis')
    const row = (await admin.adminListReservations({ venueId: 1, pageSize: 100 })).items.find((item) => item.id === created.id)
    expect(row?.companions).toEqual([{ userId: 2, displayName: '李四' }, { userId: 4, displayName: '赵六' }])
    expect((await admin.getReservation(created.id)).companions).toHaveLength(2)
  })

  it('人员改派：新预约人从名单中移除，其余保持顺序', async () => {
    const h = await asUser()
    const created = await h.api.createReservation({ ...SLOT, companionUserIds: [2, 3, 4] })
    const admin = await h.clientFor('admin_tennis')
    const moved = await admin.adminReassignUser(created.id, { userId: 3, reason: '转让' })
    expect(moved.companions.map((companion) => companion.userId)).toEqual([2, 4])
    const again = await admin.adminReassignUser(created.id, { userId: 1, reason: '还回' })
    expect(again.companions.map((companion) => companion.userId)).toEqual([2, 4])
  })

  it('人员改派的操作记录快照含 companions（与 P2-2b 后端一致）', async () => {
    const h = await asUser()
    const created = await h.api.createReservation({ ...SLOT, companionUserIds: [3] })
    const admin = await h.clientFor('admin_tennis')
    await admin.adminReassignUser(created.id, { userId: 3, reason: '转让' })
    const log = h.context.state.logs.at(-1)
    expect(log?.before).toMatchObject({ object: { companions: [{ userId: 3, displayName: '王五' }] } })
    expect(log?.after).toMatchObject({ object: { companions: [] } })
  })
})
