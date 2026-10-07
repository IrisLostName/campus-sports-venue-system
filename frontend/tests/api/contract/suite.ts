// 契约测试套件：只含与时钟无关的用例，可对任意 ApiClient 实现运行（docs/16 第 4.4 节）。
// FE-1 只对 mock 运行（见 mock.contract.spec.ts）；对真实后端的 http 版本由 BE-8 运行。
// 与时钟有关的行为（窗口边界、PAST、日期范围等）属于 mockBehavior 测试，见 tests/api/mock/。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../../src/api/client'
import { ApiError } from '../../../src/api/errors'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { ERROR_HTTP_STATUS, type ErrorCode } from '../../../src/api/types'

export interface ContractTarget {
  api: ApiClient
  setToken(token: string | null): void     // 切换当前登录身份（http 实现由 auth store 提供 Token）
}

let registrations = 0

async function loginAs(target: ContractTarget, username: string): Promise<void> {
  target.setToken(null)
  target.setToken((await target.api.login({ username, password: DEMO_PASSWORD })).token)
}

async function expectCode(pending: Promise<unknown>, code: ErrorCode): Promise<ApiError> {
  const error = await pending.then(() => undefined, (cause: unknown) => cause)
  expect(error, `期望 ${code}`).toBeInstanceOf(ApiError)
  const apiError = error as ApiError
  expect([apiError.code, apiError.status]).toEqual([code, ERROR_HTTP_STATUS[code]])
  return apiError
}

function authContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：认证与配置`, () => {
    it('三种角色的演示账号都能登录，返回 Token 与 UserProfile', async () => {
      const target = makeTarget()
      const roles: [string, string][] = [['zhangsan', 'USER'], ['admin_tennis', 'VENUE_ADMIN'], ['sysadmin', 'SYS_ADMIN']]
      for (const [username, role] of roles) {
        const session = await target.api.login({ username, password: DEMO_PASSWORD })
        expect(session.token.length).toBeGreaterThan(0)
        expect(session.user).toMatchObject({ username, role, status: 'ACTIVE' })
      }
    })

    it('错误密码 INVALID_CREDENTIALS；未登录 AUTH_REQUIRED；getMe 返回当前用户', async () => {
      const target = makeTarget()
      await expectCode(target.api.login({ username: 'zhangsan', password: 'wrong-password' }), 'INVALID_CREDENTIALS')
      await expectCode(target.api.getMe(), 'AUTH_REQUIRED')
      await loginAs(target, 'admin_pool')
      expect(await target.api.getMe()).toMatchObject({ username: 'admin_pool', venueIds: [2, 3] })
    })

    it('注册：角色强制为 USER；重复用户名 USERNAME_TAKEN；非法用户名 VALIDATION_ERROR', async () => {
      const target = makeTarget()
      registrations += 1
      const username = `contract_${registrations}`
      const session = await target.api.register({ username, password: 'Passw0rd!', displayName: '契约用户' })
      expect(session.user).toMatchObject({ username, role: 'USER' })
      await expectCode(target.api.register({ username, password: 'Passw0rd!', displayName: '契约用户' }), 'USERNAME_TAKEN')
      const error = await expectCode(target.api.register({ username: 'a', password: 'Passw0rd!', displayName: 'x' }), 'VALIDATION_ERROR')
      expect(error.details).toHaveProperty('fields')
    })

    it('预约参数公开可读，slotMinutes 固定为 90', async () => {
      const rules = await makeTarget().api.getBookingRules()
      expect(rules.slotMinutes).toBe(90)
      for (const key of ['advanceDays', 'cancelDeadlineMinutes', 'checkInOpenBeforeMinutes', 'checkInCloseAfterMinutes', 'checkOutGraceMinutes', 'maxActiveReservationsPerUser'] as const) {
        expect(rules[key]).toBeGreaterThan(0)
      }
      expect(rules.timezone).toBe('Asia/Shanghai')
    })
  })

}

function catalogContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：场馆、公告与大屏`, () => {
    it('场馆列表：网球馆可预约，羽毛球馆与游泳馆暂未开放', async () => {
      const target = makeTarget()
      await loginAs(target, 'lisi')
      const venues = await target.api.listVenues()
      expect(venues.map((v) => [v.name, v.bookable])).toEqual([['网球馆', true], ['羽毛球馆', false], ['游泳馆', false]])
    })

    it('时段查询：未开放场馆 VENUE_NOT_BOOKABLE；场馆不存在 NOT_FOUND；日期格式错误 VALIDATION_ERROR', async () => {
      const target = makeTarget()
      await loginAs(target, 'lisi')
      await expectCode(target.api.getVenueSlots(2, '2026-10-12'), 'VENUE_NOT_BOOKABLE')
      await expectCode(target.api.getVenueSlots(99999, '2026-10-12'), 'NOT_FOUND')
      await expectCode(target.api.getVenueSlots(1, 'not-a-date'), 'VALIDATION_ERROR')
    })

    it('系统公告与场馆公告各自返回', async () => {
      const target = makeTarget()
      await loginAs(target, 'lisi')
      expect((await target.api.listAnnouncements({ scope: 'SYSTEM' })).map((a) => a.title)).toContain('欢迎使用校园场馆预约系统')
      expect((await target.api.listAnnouncements({ scope: 'VENUE', venueId: 1 })).every((a) => a.venueId === 1)).toBe(true)
    })

    it('大屏聚合公开可读且不含个人信息', async () => {
      const summary = await makeTarget().api.getDisplaySummary()
      expect(summary.venues).toHaveLength(3)
      expect(summary.resources).toHaveLength(16)
      expect(summary.weekTrend).toHaveLength(7)
      const text = JSON.stringify(summary)
      expect(['zhangsan', 'lisi', 'username', 'displayName'].some((word) => text.includes(word))).toBe(false)
    })
  })

}

function reservationContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：预约的错误码`, () => {
    it('管理员账号不能创建预约 FORBIDDEN；未开放场馆的场地 VENUE_NOT_BOOKABLE', async () => {
      const target = makeTarget()
      await loginAs(target, 'sysadmin')
      await expectCode(target.api.createReservation({ resourceId: 1, serviceDate: '2026-10-12', startTime: '09:30' }), 'FORBIDDEN')
      await loginAs(target, 'lisi')
      await expectCode(target.api.createReservation({ resourceId: 5, serviceDate: '2026-10-12', startTime: '09:30' }), 'VENUE_NOT_BOOKABLE')
    })

    it('预约不存在 NOT_FOUND；格式错误 VALIDATION_ERROR', async () => {
      const target = makeTarget()
      await loginAs(target, 'lisi')
      await expectCode(target.api.getReservation(99999), 'NOT_FOUND')
      await expectCode(target.api.cancelReservation(99999), 'NOT_FOUND')
      await expectCode(target.api.createReservation({ resourceId: 1, serviceDate: 'x', startTime: '09:30' }), 'VALIDATION_ERROR')
    })

    it('我的预约分页结构', async () => {
      const target = makeTarget()
      await loginAs(target, 'wangwu')
      expect(await target.api.listMyReservations()).toMatchObject({ items: [], page: 1, pageSize: 20, total: 0 })
    })
  })

}

function permissionContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：权限与授权范围`, () => {
    it('普通用户调用管理端接口 FORBIDDEN', async () => {
      const target = makeTarget()
      await loginAs(target, 'zhangsan')
      await expectCode(target.api.adminListVenues(), 'FORBIDDEN')
      await expectCode(target.api.adminListUsers(), 'FORBIDDEN')
      await expectCode(target.api.adminListLogs(), 'FORBIDDEN')
    })

    it('场馆管理员越出授权场馆 FORBIDDEN_SCOPE；系统管理员列表不受限', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_pool')
      await expectCode(target.api.adminListResources(1), 'FORBIDDEN_SCOPE')
      await expectCode(target.api.adminGetAvailabilityRules(1), 'FORBIDDEN_SCOPE')
      await loginAs(target, 'sysadmin')
      expect((await target.api.adminListVenues()).map((v) => v.id)).toEqual([1, 2, 3])
      expect((await target.api.adminListUsers()).total).toBeGreaterThanOrEqual(7)
    })

    it('场馆管理员改 SA 才能改的字段 FORBIDDEN', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_tennis')
      await expectCode(target.api.adminUpdateVenue(1, { userBookingEnabled: false }), 'FORBIDDEN')
    })
  })

}

function adminContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：管理端配置与影响检查`, () => {
    it('场地与每周窗口取自种子：网球场1…4，周一至周日 08:00–20:00', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_tennis')
      expect((await target.api.adminListResources(1)).map((r) => r.name)).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
      const { weekly, closures } = await target.api.adminGetAvailabilityRules(1)
      expect(weekly.map((w) => [w.weekday, w.openTime, w.closeTime])).toEqual([1, 2, 3, 4, 5, 6, 7].map((d) => [d, '08:00', '20:00']))
      expect(closures).toEqual([])
    })

    it('dryRun 只计算：applied=false、cancelledIds=[]、data=null，场地状态不变', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_tennis')
      const preview = await target.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', dryRun: true })
      expect(preview).toMatchObject({ applied: false, cancelledIds: [], data: null })
      expect(preview.impact.affectedCount).toBe(preview.impact.reservations.length)
      expect((await target.api.adminListResources(1))[0]?.operationalStatus).toBe('OPEN')
    })

    it('选择 CANCEL 而不带原因 REASON_REQUIRED；管理员取消不带原因 REASON_REQUIRED', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_tennis')
      await expectCode(target.api.adminUpdateResource(1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'CANCEL' }), 'REASON_REQUIRED')
      await expectCode(target.api.adminCancelReservation(1, { reason: '' }), 'REASON_REQUIRED')
    })

    it('窗口长度不是 90 分钟整数倍 RULE_INVALID，details.reason', async () => {
      const target = makeTarget()
      await loginAs(target, 'admin_tennis')
      const error = await expectCode(
        target.api.adminReplaceWeeklyRules(1, { windows: [{ weekday: 1, openTime: '08:00', closeTime: '09:00' }], dryRun: true }),
        'RULE_INVALID')
      expect(typeof error.details?.reason).toBe('string')
    })

    it('场地数量越界 VALIDATION_ERROR；操作记录分页结构', async () => {
      const target = makeTarget()
      await loginAs(target, 'sysadmin')
      await expectCode(target.api.adminSetResourceCount(1, { count: 51, dryRun: true }), 'VALIDATION_ERROR')
      expect(await target.api.adminListLogs()).toMatchObject({ page: 1, pageSize: 20 })
    })
  })
}

export function contractSuite(label: string, makeTarget: () => ContractTarget): void {
  authContract(label, makeTarget)
  catalogContract(label, makeTarget)
  reservationContract(label, makeTarget)
  permissionContract(label, makeTarget)
  adminContract(label, makeTarget)
}
