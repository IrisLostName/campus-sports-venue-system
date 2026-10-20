// ACC-M4-02 / TEST-2 W1：主要页面浏览器走查（http 模式，真实后端），三种角色 + 运营大屏，留截图。
// 前置（单独运行，与 BE-8 的演示主线不共用一次重置）：reset-e2e-db.ps1 → start-e2e-backend.ps1 -NoSweep →
// 以 VITE_API_MODE=http 构建并 vite preview（127.0.0.1:4173）→ pnpm test:e2e:tour。
// 各步依次依赖前一步留下的数据，按书写顺序运行；每张截图前先断言页面文字并做布局测量（tourSession.capture）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CANCELED } from '../browser/pageDriver'
import { adminActions, sysAdminPages, venueAdminPages } from './adminTour'
import { backDuringSubmit } from './backDuringSubmit'
import { displayPages } from './displayTour'
import { closeTour, openTour, type Tour } from './tourSession'
import {
  seedZhaoliu, userBooking, userLoginAndEmpty, userMobile375, userRepair, userReservationAndCancel, userSeesAdminChanges,
} from './userTour'

const SLOW_REQUEST_MS = 5000

describe('ACC-M4-02 主要页面走查（http 模式，真实后端）', () => {
  let tour: Tour | undefined

  function current(): Tour {
    if (tour === undefined) {
      throw new Error('走查上下文未初始化')
    }
    return tour
  }

  beforeAll(async () => {
    tour = await openTour()
  })

  afterAll(async () => {
    await closeTour(tour)
  })

  it('用户端：登录与首页空状态（393×852，浅色与深色）', () => userLoginAndEmpty(current()))
  it('用户端：订场（场馆列表含“暂未开放预约”、时段与场馆公告、确认、成功）', () => userBooking(current()))
  it('K2：提交进行中按“后退”离开订场页（限速观察）', () => backDuringSubmit(current()))
  it('用户端：首页摘要、预约页 UPCOMING、取消层、历史“已取消”', () => userReservationAndCancel(current()))
  it('前置：zhaoliu 的预约（http 客户端）；场馆管理员在界面上改派 zhaoliu、取消 lisi', async () => {
    await seedZhaoliu(current())
    await adminActions(current())
  })
  it('用户端：改派后的管理员说明、历史“管理员已取消”', () => userSeesAdminChanges(current()))
  it('用户端：报修与“我的”滚到底', () => userRepair(current()))
  it('用户端：375×812 关键页', () => userMobile375(current()))
  it('场馆管理员端：七个导航项（1440×900）', () => venueAdminPages(current()))
  it('系统管理员端：十一个导航项（1440×900）', () => sysAdminPages(current()))
  it('运营大屏：1440×900、1920×1080、1366×768（固定深色）', () => displayPages(current()))

  it('没有失败或超过 5 秒的接口请求，页面脚本没有异常', () => {
    const { page, pageErrors } = current()
    const failed = page.requests.filter((request) => request.failure !== null && request.failure !== CANCELED)
    current().record('summary', { requests: page.requests.length, failed, shots: current().shots.length })
    expect(failed).toEqual([])
    expect(page.requests.filter((request) => (request.durationMs ?? 0) > SLOW_REQUEST_MS)).toEqual([])
    expect(pageErrors).toEqual([])
  })
})
