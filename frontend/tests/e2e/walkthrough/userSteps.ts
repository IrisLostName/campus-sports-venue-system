// 演示主线第 1、2、3、5 步（docs/04 第 2 节）：架构、用户端订场、并发与先来先得、用户看到改派结果。
// 用户端视口 375×812，另补 393×852（iPhone 16）。数据：wangwu 订明天 网球场3 11:00；
// 第 3 步 zhaoliu 与 lisi 并发抢 网球场3 12:30；zhangsan 在界面上提交 网球场4 14:00 前被 lisi 抢先。
import { expect } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { DESKTOP, IPHONE16, MOBILE } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'
import { makeHttpTarget, type RecordingTarget } from '../support/httpTarget'
import { loginUi, openVenueSlots, pickSlot, shot, visit, type Walk } from './session'

export async function step1Architecture(walk: Walk): Promise<void> {
  const { page } = walk
  await page.setViewport(DESKTOP)
  await page.goto(`${E2E.apiBaseUrl}/api/v1/config/booking-rules`)
  await page.waitForText('slotMinutes')
  await shot(walk, '10-01-backend-booking-rules')
  await page.setViewport(MOBILE)
  await visit(walk, '/login')
  await page.waitForText('校园场馆预约系统')
  await shot(walk, '10-01-frontend-login')
  walk.record('step1', { frontendOrigin: E2E.appUrl, backendBaseUrl: E2E.apiBaseUrl, today: walk.today, tomorrow: walk.tomorrow })
}

export async function step2UserBooking(walk: Walk): Promise<void> {
  const { page } = walk
  await loginUi(walk, 'wangwu', MOBILE, '10-02a-login')
  await page.waitForText('你还没有预约')
  await shot(walk, '10-02b-home-empty')
  await page.clickText('去订场')
  await openVenueSlots(walk, '网球馆', '网球场1')
  await page.scrollTo('section[aria-label="网球场3"]')
  await shot(walk, '10-02c-booking-slots')
  await pickSlot(walk, '网球场3', '11:00')
  await page.waitForText('用途（可选）')
  await page.fill('用途（可选）', '周末约练（演示）')
  await shot(walk, '10-02d-booking-confirm')
  await page.clickText('确认预约', { selector: 'button' })
  await page.waitForText('预约成功')
  await shot(walk, '10-02e-booking-success')
  await page.clickText('回到首页')
  await page.waitForText('查看预约详情')
  await shot(walk, '10-02f-home-summary')
  await page.clickText('查看预约详情')
  await page.waitForText('周末约练（演示）')
  await shot(walk, '10-02g-reservation-detail')
  await page.setViewport(IPHONE16)
  await visit(walk, '/')
  await page.waitForText('查看预约详情')
  await shot(walk, '10-02h-home')
  await visit(walk, '/booking')
  await openVenueSlots(walk, '网球馆', '网球场1')
  await shot(walk, '10-02i-booking-slots')
}

async function resourceIdOf(target: RecordingTarget, walk: Walk, name: string): Promise<number> {
  const slots = await target.api.getVenueSlots(1, walk.tomorrow)
  const resource = slots.resources.find((item) => item.resourceName === name)
  expect(resource, name).toBeDefined()
  return resource?.resourceId ?? 0
}

function outcome(result: PromiseSettledResult<unknown>): unknown {
  if (result.status === 'fulfilled') {
    return { ok: true, reservation: result.value }
  }
  const error = result.reason as ApiError
  return { ok: false, status: error.status, code: error.code, message: error.message }
}

// 3a：两个用户用前端自己的 http 客户端同时提交同一时段，恰好一个成功、另一个 SLOT_TAKEN（BE-8 裁决 W3）。
async function concurrentPair(walk: Walk, lisi: RecordingTarget): Promise<void> {
  const zhaoliu = makeHttpTarget()
  await zhaoliu.loginAs('zhaoliu')
  const request = { resourceId: await resourceIdOf(zhaoliu, walk, '网球场3'), serviceDate: walk.tomorrow, startTime: '12:30' }
  const results = await Promise.allSettled([zhaoliu.api.createReservation(request), lisi.api.createReservation(request)])
  walk.record('step3-concurrent', { request, users: ['zhaoliu', 'lisi'], outcomes: results.map(outcome) })
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  const rejected = results.find((result) => result.status === 'rejected')
  const error = rejected?.status === 'rejected' ? rejected.reason : undefined
  expect(error).toBeInstanceOf(ApiError)
  expect([(error as ApiError).code, (error as ApiError).status]).toEqual(['SLOT_TAKEN', 409])
}

export async function step3Concurrency(walk: Walk): Promise<void> {
  const { page } = walk
  const lisi = makeHttpTarget()
  await lisi.loginAs('lisi')
  await concurrentPair(walk, lisi)
  // 3b：zhangsan 已进入确认步骤，lisi 抢先订走同一时段，zhangsan 提交时看到 SLOT_TAKEN 的提示。
  await loginUi(walk, 'zhangsan', MOBILE)
  await visit(walk, '/booking')
  await openVenueSlots(walk, '网球馆', '网球场1')
  await pickSlot(walk, '网球场4', '14:00')
  await page.waitForText('用途（可选）')
  await shot(walk, '10-03a-confirm-before-taken')
  const request = { resourceId: await resourceIdOf(lisi, walk, '网球场4'), serviceDate: walk.tomorrow, startTime: '14:00' }
  walk.record('step3-taken-first', { user: 'lisi', reservation: await lisi.api.createReservation(request) })
  await page.clickText('确认预约', { selector: 'button' })
  await page.waitForText('该时段刚刚被别人预约了，请重新选择')
  await shot(walk, '10-03b-slot-taken')
}

export async function step5UserSeesChange(walk: Walk): Promise<void> {
  const { page } = walk
  await loginUi(walk, 'wangwu', MOBILE)
  await visit(walk, '/reservation')
  await page.waitForText('管理员说明')
  await page.waitForText('网球场5')
  await page.scrollTo('section[aria-label="管理员说明"]')
  await shot(walk, '10-05-reservation-reassigned')
}
