// API-SYNC 台账（docs/evidence/ACC-M3-12.md）中 mock 以后端为准的输入口径：
// S-040 显式 null、S-041 空白可选文本、S-043 口令 72 字节、S-044 周窗口 null 元素、S-050 空白判定与后端一致。
import { describe, expect, it } from 'vitest'

import type {
  AdminCancelRequest, CreateReservationRequest, RegisterRequest, ReplaceWeeklyRulesRequest, UpdateUserRequest,
  UpdateResourceRequest, UpdateVenueRequest,
} from '../../../src/api/requests'
import { createHarness, expectApiError, TOMORROW, type Harness } from '../support/harness'

const NEWCOMER = { username: 'newcomer', password: 'Passw0rd!', displayName: '新同学' }
const FULL_WIDTH_SPACE = '　'
const NBSP = ' '

async function as(username: string): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('S-040 请求中的 null 与缺省等价', () => {
  it('注册：phone、userType 为 null 视为未填', async () => {
    const h = createHarness()
    const session = await h.api.register({ ...NEWCOMER, phone: null, userType: null } as unknown as RegisterRequest)
    expect(session.user).toMatchObject({ phone: null, userType: 'STUDENT' })
  })

  it('场馆管理员提交值为 null 的 SA 专属字段不算提交，不得 FORBIDDEN', async () => {
    const h = await as('admin_tennis')
    const request = { name: null, operationalStatus: null, description: '欢迎来打球' } as unknown as UpdateVenueRequest
    const result = await h.api.adminUpdateVenue(1, request)
    expect(result.data).toMatchObject({ name: '网球馆', description: '欢迎来打球' })
  })

  it('影响检查：onExistingReservations 为 null 视为未给出', async () => {
    const h = await as('sysadmin')
    const request = { operationalStatus: 'MAINTENANCE', onExistingReservations: null } as unknown as UpdateResourceRequest
    await expectApiError(h.api.adminUpdateResource(1, request), 'IMPACT_CONFIRMATION_REQUIRED')
  })

  it('管理员覆盖：reason 为 null 得 REASON_REQUIRED', async () => {
    const h = await as('admin_tennis')
    await expectApiError(h.api.adminCancelReservation(1, { reason: null } as unknown as AdminCancelRequest), 'REASON_REQUIRED')
  })

  it('创建预约：purpose 为 null 视为未填', async () => {
    const h = await as('wangwu')
    const request = { resourceId: 3, serviceDate: TOMORROW, startTime: '08:00', purpose: null }
    const created = await h.api.createReservation(request as unknown as CreateReservationRequest)
    expect(created.purpose).toBeNull()
  })

  it('修改账号：status 为 null 不算状态改变，不写 USER_STATUS_CHANGE', async () => {
    const h = await as('sysadmin')
    const updated = await h.api.adminUpdateUser(4, { displayName: '赵六六', status: null } as unknown as UpdateUserRequest)
    expect(updated).toMatchObject({ displayName: '赵六六', status: 'ACTIVE' })
    expect((await h.api.adminListLogs({ action: 'USER_STATUS_CHANGE' })).total).toBe(0)
  })
})

describe('S-041 新建与查询类的空白可选文本视为未填', () => {
  it('注册：空白 phone 存 null', async () => {
    const session = await createHarness().api.register({ ...NEWCOMER, phone: '   ' })
    expect(session.user.phone).toBeNull()
  })

  it('新建场馆：空白 location、description 存 null', async () => {
    const h = await as('sysadmin')
    const venue = await h.api.adminCreateVenue({ name: '篮球馆', venueType: 'BASKETBALL', location: '  ', description: ' ' })
    expect(venue).toMatchObject({ location: null, description: null })
  })

  it('创建预约：空白 purpose 存 null；取消：空白 reason 存 null', async () => {
    const h = await as('zhangsan')
    const created = await h.api.createReservation({ resourceId: 2, serviceDate: TOMORROW, startTime: '08:00', purpose: '  ' })
    expect(created.purpose).toBeNull()
    expect((await h.api.cancelReservation(created.id, { reason: '   ' })).cancelReason).toBeNull()
  })

  it('列表关键字：空白视为未填，不报 VALIDATION_ERROR', async () => {
    const h = await as('sysadmin')
    expect((await h.api.adminListUsers({ keyword: '   ' })).total).toBe(7)
    expect((await h.api.adminListReservations({ keyword: '  ' })).total).toBe(2)
  })
})

describe('S-043 口令按 UTF-8 不超过 72 字节', () => {
  it('25 个汉字（75 字节）被拒，24 个汉字（72 字节）可以', async () => {
    const h = createHarness()
    await expectApiError(h.api.register({ ...NEWCOMER, password: '密'.repeat(25) }), 'VALIDATION_ERROR',
      { fields: { password: '不能超过 72 字节' } })
    await expect(h.api.register({ ...NEWCOMER, password: '密'.repeat(24) })).resolves.toMatchObject({ user: { username: 'newcomer' } })
  })

  it('创建账号同样检查', async () => {
    const h = await as('sysadmin')
    await expectApiError(h.api.adminCreateUser({ ...NEWCOMER, role: 'USER', password: '密'.repeat(25) }), 'VALIDATION_ERROR',
      { fields: { password: '不能超过 72 字节' } })
  })
})

describe('S-044 周窗口中的 null 元素', () => {
  it('报 windows[i]“必填”，不抛出非预期异常', async () => {
    const h = await as('sysadmin')
    const request = { windows: [null, { weekday: 1, openTime: '08:00', closeTime: '09:30' }] }
    await expectApiError(h.api.adminReplaceWeeklyRules(1, request as unknown as ReplaceWeeklyRulesRequest), 'VALIDATION_ERROR',
      { fields: { 'windows[0]': '必填' } })
  })
})

describe('S-050 空白的判定与后端一致', () => {
  it('格式检查只认 ASCII 空白：全角空格的名称不算空白', async () => {
    const h = await as('sysadmin')
    const result = await h.api.adminUpdateVenue(3, { name: FULL_WIDTH_SPACE })
    expect(result.data?.name).toBe(FULL_WIDTH_SPACE)
  })

  it('关键字去首尾空白同 Java trim()：前导全角空格不去掉，因而不匹配', async () => {
    const h = await as('sysadmin')
    expect((await h.api.adminListUsers({ keyword: `${FULL_WIDTH_SPACE}张三` })).total).toBe(0)
    expect((await h.api.adminListUsers({ keyword: ' 张三 ' })).total).toBe(1)
  })

  it('原因是否填写同 Java isBlank()：NBSP 算已填写，全角空格算空白', async () => {
    const h = await as('admin_tennis')
    await expectApiError(h.api.adminCancelReservation(2, { reason: FULL_WIDTH_SPACE }), 'REASON_REQUIRED')
    const cancelled = await h.api.adminCancelReservation(1, { reason: NBSP })
    expect(cancelled).toMatchObject({ status: 'ADMIN_CANCELLED', adminNote: NBSP })
  })

  it('可选文本同 Java isBlank()：全角空格的 phone 视为未填，存 null', async () => {
    const session = await createHarness().api.register({ ...NEWCOMER, phone: FULL_WIDTH_SPACE })
    expect(session.user.phone).toBeNull()
  })
})
