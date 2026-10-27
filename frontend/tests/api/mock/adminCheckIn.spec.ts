// v1.1 扫码签到（docs/12 第 5.7 节 POST /admin/check-ins；docs/10 第 4 节；P2-1c 裁决第 0 节第 2 条）。
// 种子预约 1：zhangsan，明天 08:00–09:30（网球馆）；签到窗口是闭区间 [07:45:00, 08:15:00]。
// 阶段顺序与后端 AdminCheckInService 一致：认证 → 格式 → 角色 → 签到码 → 范围 → 状态 → 窗口 → 是否已签到。
// 原 checkInOut.spec.ts 中签到窗口边界与签到错误码的用例改为扫码后移到这里。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { CHECK_IN_CODE_PATTERN } from '../../../src/api/mock/checkInCodes'
import { createHarness, expectApiError, travel, TOMORROW, type Harness } from '../support/harness'

const ID = 1
const at = (time: string) => `${TOMORROW}T${time}`
const FORGED_UUID = '00000000-0000-4000-8000-000000000000'

// zhangsan 在 time 时刻取码，返回 harness、码与系统管理员客户端。
async function codeAt(time: string, admin = 'sysadmin'): Promise<{ h: Harness; code: string; staff: ApiClient }> {
  const h = createHarness()
  await travel(h, at(time), 'zhangsan')
  const { code } = await h.api.getCheckInCode(ID)
  return { h, code, staff: await h.clientFor(admin) }
}

function uuidOf(code: string): string {
  return code.split('.')[0] ?? ''
}

describe('签到窗口边界（扫码）', () => {
  it.each([['07:45:00'], ['07:45:01'], ['08:00:00'], ['08:14:59'], ['08:15:00']])('%s 可以签到', async (time) => {
    const { code, staff } = await codeAt(time)
    const result = await staff.adminCheckIn({ code })
    expect(result).toMatchObject({ id: ID, checkInAt: at(time), displayStatus: 'IN_USE', status: 'CONFIRMED' })
  })

  it.each([['07:44:59'], ['07:44:00'], ['06:00:00']])('%s 窗口未开 → CHECKIN_WINDOW_CLOSED，details 含 opensAt/closesAt', async (time) => {
    const { code, staff } = await codeAt(time)
    await expectApiError(staff.adminCheckIn({ code }), 'CHECKIN_WINDOW_CLOSED', {
      opensAt: at('07:45:00'), closesAt: at('08:15:00'),
    })
  })

  it('08:15:01 起已越过判定点：预约成为 NO_SHOW，扫码 → INVALID_STATE', async () => {
    const { h, code, staff } = await codeAt('08:00:00')
    h.clock.set(at('08:15:01'))
    await expectApiError(staff.adminCheckIn({ code }), 'INVALID_STATE', { status: 'NO_SHOW' })
  })
})

describe('扫码签到的结果', () => {
  it('成功：返回 AdminReservation（含预约人姓名、用户名与电话），预约变为使用中', async () => {
    const { h, code, staff } = await codeAt('08:00:00')
    const result = await staff.adminCheckIn({ code })
    expect(result).toMatchObject({ userDisplayName: '张三', userUsername: 'zhangsan', userPhone: null, resourceName: '网球场1' })
    expect((await h.api.getReservation(ID)).displayStatus).toBe('IN_USE')
  })

  it('不写管理员操作日志', async () => {
    const { code, staff } = await codeAt('08:00:00')
    const before = (await staff.adminListLogs()).total
    await staff.adminCheckIn({ code })
    expect((await staff.adminListLogs()).total).toBe(before)
  })

  it('场馆管理员在授权范围内可以扫码', async () => {
    const { code, staff } = await codeAt('08:00:00', 'admin_tennis')
    await expect(staff.adminCheckIn({ code })).resolves.toMatchObject({ id: ID, displayStatus: 'IN_USE' })
  })

  it('码中的 UUID 大写也接受（按 UUID 值比较）', async () => {
    const { code, staff } = await codeAt('08:00:00')
    await expect(staff.adminCheckIn({ code: code.toUpperCase() })).resolves.toMatchObject({ id: ID })
  })
})

describe('扫码签到的错误码与顺序', () => {
  it('窗口内重复扫码 → ALREADY_CHECKED_IN', async () => {
    const { code, staff } = await codeAt('08:00:00')
    await staff.adminCheckIn({ code })
    await expectApiError(staff.adminCheckIn({ code }), 'ALREADY_CHECKED_IN')
  })

  it('窗口外已签到者再扫码 → CHECKIN_WINDOW_CLOSED（先于 ALREADY_CHECKED_IN）', async () => {
    const { h, code, staff } = await codeAt('08:00:00')
    await staff.adminCheckIn({ code })
    h.clock.set(at('08:20:00'))
    await expectApiError(staff.adminCheckIn({ code }), 'CHECKIN_WINDOW_CLOSED')
  })

  it('已取消 → INVALID_STATE（先于窗口检查）', async () => {
    const { h, code, staff } = await codeAt('05:00:00')
    await h.api.cancelReservation(ID)
    await expectApiError(staff.adminCheckIn({ code }), 'INVALID_STATE', { status: 'CANCELLED' })
  })

  it('伪造的 UUID、拿本人 UUID 拼他人预约 id、预约不存在 → CHECKIN_CODE_INVALID（不区分，不带 details）', async () => {
    const { code, staff } = await codeAt('08:00:00')
    for (const forged of [`${FORGED_UUID}.${ID}`, `${uuidOf(code)}.2`, `${uuidOf(code)}.999`]) {
      const error = await expectApiError(staff.adminCheckIn({ code: forged }), 'CHECKIN_CODE_INVALID')
      expect(error.details).toBeUndefined()
    }
  })

  it('拿他人的 UUID 拼本人预约 id → CHECKIN_CODE_INVALID', async () => {
    const { h, staff } = await codeAt('08:00:00')
    await h.loginAs('lisi')
    const { code: lisiCode } = await h.api.getCheckInCode(2)
    await expectApiError(staff.adminCheckIn({ code: `${uuidOf(lisiCode)}.${ID}` }), 'CHECKIN_CODE_INVALID')
  })

  it('场馆管理员越出授权范围 → FORBIDDEN_SCOPE（details.venueId 为预约所属场馆）', async () => {
    const { code, staff } = await codeAt('08:00:00', 'admin_pool')
    await expectApiError(staff.adminCheckIn({ code }), 'FORBIDDEN_SCOPE', { venueId: 1 })
  })

  it('范围外且码无效时先报 CHECKIN_CODE_INVALID（签到码先于范围）', async () => {
    const { staff } = await codeAt('08:00:00', 'admin_pool')
    await expectApiError(staff.adminCheckIn({ code: `${FORGED_UUID}.${ID}` }), 'CHECKIN_CODE_INVALID')
  })

  it('普通用户调用 → FORBIDDEN；格式错误先于角色 → VALIDATION_ERROR', async () => {
    const { h, code } = await codeAt('08:00:00')
    await expectApiError(h.api.adminCheckIn({ code }), 'FORBIDDEN')
    await expectApiError(h.api.adminCheckIn({ code: 'x' }), 'VALIDATION_ERROR')
  })

  it('格式错误 → VALIDATION_ERROR，fields.code（空白、超长、前导 0、缺少点号、首尾空白不去除）', async () => {
    const { code, staff } = await codeAt('08:00:00')
    for (const bad of ['', '   ', 'x'.repeat(101), `${uuidOf(code)}.01`, uuidOf(code), ` ${code}`, `${code} `]) {
      const error = await expectApiError(staff.adminCheckIn({ code: bad }), 'VALIDATION_ERROR')
      expect(Object.keys((error.details?.fields ?? {}) as object)).toEqual(['code'])
    }
  })

  it('未登录 → AUTH_REQUIRED（先于格式）', async () => {
    const h = createHarness()
    await expectApiError(h.api.adminCheckIn({ code: 'x' }), 'AUTH_REQUIRED')
  })
})

describe('签到标识', () => {
  it('每个种子用户的签到标识互不相同，且是小写 v4 UUID', async () => {
    const h = createHarness()
    const uuids = h.context.state.users.map((user) => user.checkInUuid)
    expect(new Set(uuids).size).toBe(uuids.length)
    for (const uuid of uuids) {
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
  })

  it('注册与系统管理员新建的用户自动获得签到标识；标识不出现在任何用户资料里', async () => {
    const h = createHarness()
    const registered = await h.api.register({ username: 'newbie', password: '12345678', displayName: '新人' })
    await h.loginAs('sysadmin')
    const created = await h.api.adminCreateUser({ username: 'teacher1', password: '12345678', displayName: '老师', role: 'USER' })
    const records = h.context.state.users.filter((user) => user.username === 'newbie' || user.username === 'teacher1')
    expect(records.map((user) => user.checkInUuid).every((uuid) => /^[0-9a-f-]{36}$/.test(uuid))).toBe(true)
    expect(JSON.stringify([registered, created, await h.api.adminListUsers()])).not.toMatch(/checkInUuid|[0-9a-f]{8}-[0-9a-f]{4}-4/)
  })

  it('签到码格式与后端正则一致', () => {
    expect(CHECK_IN_CODE_PATTERN.test(`${FORGED_UUID}.1`)).toBe(true)
    expect(CHECK_IN_CODE_PATTERN.test(`${FORGED_UUID}.${'9'.repeat(18)}`)).toBe(true)
    expect(CHECK_IN_CODE_PATTERN.test(`${FORGED_UUID}.${'9'.repeat(19)}`)).toBe(false)
    expect(CHECK_IN_CODE_PATTERN.test(`${FORGED_UUID}.0`)).toBe(false)
  })
})
