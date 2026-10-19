// ACC-M3-10：演示主线（docs/04 第 2 节 1–9 步）在 http 模式下对真实后端逐步走通（BE-8 裁决第 3 节）。
// 前置：reset-e2e-db.ps1 → start-e2e-backend.ps1 -NoSweep → 以 VITE_API_MODE=http 构建并 vite preview（127.0.0.1:4173）。
// 各步依次依赖前一步留下的数据，按书写顺序运行；每张截图前先断言页面文字。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CANCELED } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'
import { k4RuleInvalid, step4VenueAdmin, step7Isolation } from './adminSteps'
import { closeWalk, openWalk, type Walk } from './session'
import { step6Generality, step8SysAdmin, step9Display } from './sysSteps'
import { step1Architecture, step2UserBooking, step3Concurrency, step5UserSeesChange } from './userSteps'

const SLOW_REQUEST_MS = 5000

describe('ACC-M3-10 演示主线（http 模式，真实后端）', () => {
  let walk: Walk | undefined

  function current(): Walk {
    if (walk === undefined) {
      throw new Error('走查上下文未初始化')
    }
    return walk
  }

  beforeAll(async () => {
    walk = await openWalk()
  })

  afterAll(async () => {
    await closeWalk(walk)
  })

  it('1 架构：前端（4173）与后端（8080）是两个独立进程，前端经 VITE_API_BASE_URL 访问后端', () => step1Architecture(current()))
  it('2 用户端：登录 → 首页空状态 → 订场 → 首页摘要 → 预约详情', () => step2UserBooking(current()))
  it('3 并发与先来先得：恰好一个成功，另一个 SLOT_TAKEN', () => step3Concurrency(current()))
  it('4 场馆管理员端：占用总览、场地数量、维护预检、改派并填写原因', () => step4VenueAdmin(current()))
  it('K4 开放规则不合法时显示后端的 details.reason', () => k4RuleInvalid(current()))
  it('5 用户端看到改派结果与管理员说明', () => step5UserSeesChange(current()))
  it('6 通用性：泳道数量、一键开放预约、新增场馆', () => step6Generality(current()))
  it('7 权限隔离：场馆管理员越权 403，系统管理员可以覆盖', () => step7Isolation(current()))
  it('8 系统管理员端：授权、公告、全局统计、操作记录', () => step8SysAdmin(current()))
  it('9 运营大屏：只读聚合指标，无个人信息', () => step9Display(current()))

  it('K3 没有挂起、失败或超过 5 秒的接口请求', () => {
    const requests = current().page.requests
    current().record('k3-summary', {
      total: requests.length, canceled: requests.filter((request) => request.failure === CANCELED).length,
      maxDurationMs: Math.max(0, ...requests.map((request) => request.durationMs ?? 0)),
      allowOrigins: [...new Set(requests.map((request) => request.allowOrigin))],
    })
    expect(requests.filter((request) => request.failure !== null && request.failure !== CANCELED)).toEqual([])
    expect(requests.filter((request) => (request.durationMs ?? 0) > SLOW_REQUEST_MS)).toEqual([])
    // E3 正证：前端页面发出的跨源请求都带回 Access-Control-Allow-Origin = 前端来源（第 1 步直接打开后端地址的那次除外）。
    const fromApp = requests.filter((request) => request.allowOrigin !== null || !request.url.endsWith('/config/booking-rules'))
    expect([...new Set(fromApp.map((request) => request.allowOrigin))]).toEqual([E2E.appUrl])
  })
})
