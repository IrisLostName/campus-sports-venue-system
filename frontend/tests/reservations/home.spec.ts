// 首页（FE-3 规划裁决 P2；ACC-M2-02、ACC-M2-03）：最近一条预约摘要、“还有 N 个预约”、系统公告、空状态。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { PATHS } from '../../src/router/paths'
import { loginAs, TOMORROW } from './harness'

const SUMMARY = {
  kind: 'summary',
  summary: {
    id: 1, dateText: '2026-10-13 周二', timeText: '08:00–09:30', place: '网球馆 · 网球场1',
    userDisplayName: '张三', statusLabel: '待使用', displayStatus: 'UPCOMING',
  },
  moreCount: 0,
}

describe('ACC-M2-02 首页有预约', () => {
  it('zhangsan：摘要含时间、地点、人物与状态；公告区排在摘要之后', async () => {
    const { homeBoard } = await loginAs('zhangsan', '/')
    const home = homeBoard()
    await home.load()

    expect(home.sections.value).toEqual([SUMMARY, { kind: 'announcements' }])
    expect(home.sections.value.map((section) => section.kind)).toEqual(['summary', 'announcements'])
  })

  it('系统公告：只含 SYSTEM 公告（不含场馆公告），带发布时间；正文与标题相同则不重复', async () => {
    const { homeBoard } = await loginAs('zhangsan', '/')
    const home = homeBoard()
    await home.load()

    expect(home.announcementError.value).toBeNull()
    expect(home.announcementsLoaded.value).toBe(true)
    expect(home.announcementItems.value).toEqual([
      { id: 1, title: '欢迎使用校园场馆预约系统', content: null, publishedText: '2026-10-12 09:00' },
    ])
  })

  it('系统管理员发布新公告后：按发布时间倒序，标题、正文、发布时间都显示', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    h.clock.advanceMinutes(30)
    await (await h.clientFor('sysadmin')).adminCreateAnnouncement({ scope: 'SYSTEM', title: '周末闭馆通知', content: '本周六全天闭馆维护' })
    const home = homeBoard()
    await home.load()

    expect(home.announcementItems.value.map((item) => [item.title, item.content, item.publishedText])).toEqual([
      ['周末闭馆通知', '本周六全天闭馆维护', '2026-10-12 09:30'],
      ['欢迎使用校园场馆预约系统', null, '2026-10-12 09:00'],
    ])
  })
})

describe('“还有 N 个预约”', () => {
  it('同一用户 2 条 CURRENT：摘要是开始时间最早的一条，还有 1 个', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    await h.api.createReservation({ resourceId: 3, serviceDate: '2026-10-12', startTime: '09:30' })
    const home = homeBoard()
    await home.load()

    expect(home.sections.value[0]).toMatchObject({
      kind: 'summary', moreCount: 1,
      summary: { dateText: '2026-10-12 周一', timeText: '09:30–11:00', place: '网球馆 · 网球场3' },
    })
  })

  it('3 条 CURRENT：还有 2 个', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    await h.api.createReservation({ resourceId: 2, serviceDate: TOMORROW, startTime: '11:00' })
    await h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '12:30' })
    const home = homeBoard()
    await home.load()

    expect(home.sections.value[0]).toMatchObject({ kind: 'summary', moreCount: 2, summary: { id: 1, timeText: '08:00–09:30' } })
  })

  it('只有 1 条：没有“还有”，计数为 0', async () => {
    const { homeBoard } = await loginAs('zhangsan', '/')
    const home = homeBoard()
    await home.load()

    expect(home.sections.value[0]).toMatchObject({ kind: 'summary', moreCount: 0 })
  })
})

describe('ACC-M2-03 首页无预约', () => {
  it('wangwu：空状态，入口指向 /booking；公告区照常显示', async () => {
    const { homeBoard, h } = await loginAs('wangwu', '/')
    const home = homeBoard()
    await home.load()

    expect(home.sections.value).toEqual([{ kind: 'empty' }, { kind: 'announcements' }])
    expect(home.announcementItems.value).toHaveLength(1)
    expect(PATHS.booking).toBe('/booking')
    expect(h.router.resolve(PATHS.booking).name).toBe('booking')
  })

  it('取消了唯一一条预约后刷新：变为空状态', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    await h.api.cancelReservation(1, {})
    const home = homeBoard()
    await home.load()

    expect(home.sections.value[0]).toEqual({ kind: 'empty' })
  })
})

describe('加载失败', () => {
  it('预约列表失败：显示错误与重试而不是空状态；公告不受影响', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    const failing: ApiClient = { ...h.api, listMyReservations: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) }
    const home = homeBoard(failing)
    await home.load()

    expect(home.sections.value).toEqual([
      { kind: 'reservationError', message: '服务器开小差了，请稍后再试' }, { kind: 'announcements' },
    ])
    expect(home.announcementItems.value).toHaveLength(1)
  })

  it('公告失败：摘要照常显示，公告区给出错误文案', async () => {
    const { homeBoard, h } = await loginAs('zhangsan', '/')
    const failing: ApiClient = { ...h.api, listAnnouncements: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) }
    const home = homeBoard(failing)
    await home.load()

    expect(home.sections.value).toEqual([SUMMARY, { kind: 'announcements' }])
    expect(home.announcementError.value).toBe('服务器开小差了，请稍后再试')
    expect(home.announcementItems.value).toEqual([])
  })
})
