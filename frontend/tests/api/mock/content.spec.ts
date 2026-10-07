// 公告（docs/12 第 5.2、5.8 节）与报修（第 5.4 节）；流程见 docs/10 第 7 节。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, travel, TODAY, type Harness } from '../support/harness'

async function as(username: string): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('用户端公告', () => {
  it('系统公告与场馆公告分开返回，不混用', async () => {
    const h = await as('zhangsan')
    expect((await h.api.listAnnouncements({ scope: 'SYSTEM' })).every((a) => a.scope === 'SYSTEM' && a.venueId === null)).toBe(true)
    expect((await h.api.listAnnouncements({ scope: 'VENUE', venueId: 1 })).every((a) => a.venueId === 1)).toBe(true)
  })

  it('只返回 ACTIVE 且未过期，按发布时间倒序', async () => {
    const h = await as('sysadmin')
    const older = await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: '旧', content: 'c', expiresAt: `${TODAY}T09:00:00` })
    h.clock.advanceMinutes(10)
    const newer = await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: '新', content: 'c' })
    await h.loginAs('zhangsan')
    expect((await h.api.listAnnouncements({ scope: 'SYSTEM' })).map((a) => a.title)).toEqual(['新', '旧', '欢迎使用校园场馆预约系统'])
    await travel(h, `${TODAY}T09:00:00`, 'zhangsan')
    expect((await h.api.listAnnouncements({ scope: 'SYSTEM' })).map((a) => a.title)).toEqual(['新', '欢迎使用校园场馆预约系统'])
    await h.loginAs('sysadmin')
    await h.api.adminArchiveAnnouncement(newer.id)
    await h.loginAs('zhangsan')
    expect((await h.api.listAnnouncements({ scope: 'SYSTEM' })).map((a) => a.title)).toEqual(['欢迎使用校园场馆预约系统'])
    expect(older.status).toBe('ACTIVE')
  })

  it('publishedByName 为发布人姓名；scope=VENUE 必须带 venueId；scope 必填', async () => {
    const h = await as('zhangsan')
    expect((await h.api.listAnnouncements({ scope: 'SYSTEM' }))[0]?.publishedByName).toBe('系统管理员')
    expect((await h.api.listAnnouncements({ scope: 'VENUE', venueId: 1 }))[0]?.publishedByName).toBe('网球馆管理员')
    await expectApiError(h.api.listAnnouncements({ scope: 'VENUE' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.listAnnouncements({} as { scope: 'SYSTEM' }), 'VALIDATION_ERROR')
  })
})

describe('管理端公告', () => {
  it('场馆管理员可发布授权场馆的场馆公告，写日志 ANNOUNCEMENT_PUBLISH', async () => {
    const h = await as('admin_tennis')
    const created = await h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 1, title: '闭馆通知', content: '周五闭馆' })
    expect(created).toMatchObject({ scope: 'VENUE', venueId: 1, status: 'ACTIVE', publishedByName: '网球馆管理员', expiresAt: null })
    expect((await h.api.adminListLogs({ action: 'ANNOUNCEMENT_PUBLISH' })).items[0]).toMatchObject({ targetId: created.id, venueId: 1 })
  })

  it('场馆管理员：发系统公告 FORBIDDEN；发越权场馆 FORBIDDEN_SCOPE', async () => {
    const h = await as('admin_tennis')
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: 't', content: 'c' }), 'FORBIDDEN')
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 2, title: 't', content: 'c' }), 'FORBIDDEN_SCOPE')
  })

  it('系统管理员两种都可发；scope 与 venueId 必须匹配', async () => {
    const h = await as('sysadmin')
    await expect(h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: 't', content: 'c' })).resolves.toMatchObject({ venueId: null })
    await expect(h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 3, title: 't', content: 'c' })).resolves.toMatchObject({ venueId: 3 })
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'VENUE', title: 't', content: 'c' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'SYSTEM', venueId: 1, title: 't', content: 'c' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 99, title: 't', content: 'c' }), 'NOT_FOUND')
    await expectApiError(h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: '', content: 'c' }), 'VALIDATION_ERROR')
  })

  it('场馆管理员的列表含授权场馆的公告和系统公告（含 ARCHIVED），不含其他场馆', async () => {
    const h = await as('sysadmin')
    await h.api.adminCreateAnnouncement({ scope: 'VENUE', venueId: 2, title: '羽毛球馆公告', content: 'c' })
    await h.api.adminArchiveAnnouncement(1)
    await h.loginAs('admin_tennis')
    const titles = (await h.api.adminListAnnouncements()).items.map((a) => a.title)
    expect(titles).toContain('欢迎使用校园场馆预约系统')
    expect(titles).not.toContain('羽毛球馆公告')
    expect((await h.api.adminListAnnouncements({ status: 'ARCHIVED' })).items.map((a) => a.id)).toEqual([1])
    await expectApiError(h.api.adminListAnnouncements({ venueId: 2 }), 'FORBIDDEN_SCOPE')
  })

  it('归档：返回 undefined（204），状态变 ARCHIVED，写日志；场馆管理员不能归档系统公告', async () => {
    const h = await as('admin_tennis')
    await expectApiError(h.api.adminArchiveAnnouncement(1), 'FORBIDDEN')
    await expect(h.api.adminArchiveAnnouncement(2)).resolves.toBeUndefined()
    expect((await h.api.adminListAnnouncements({ status: 'ARCHIVED' })).items.map((a) => a.id)).toEqual([2])
    expect((await h.api.adminListLogs({ action: 'ANNOUNCEMENT_ARCHIVE' })).total).toBe(1)
    await expectApiError(h.api.adminArchiveAnnouncement(99), 'NOT_FOUND')
  })
})

describe('报修', () => {
  it('用户提交：状态 SUBMITTED，场馆级与场地级', async () => {
    const h = await as('zhangsan')
    const venueLevel = await h.api.createRepair({ venueId: 1, description: '更衣室灯坏了' })
    const resourceLevel = await h.api.createRepair({ venueId: 1, resourceId: 2, description: '球网破了' })
    expect(venueLevel).toMatchObject({ status: 'SUBMITTED', resourceId: null, resourceName: null, venueName: '网球馆', reporterName: '张三' })
    expect(resourceLevel).toMatchObject({ resourceId: 2, resourceName: '网球场2', resultNote: null })
    expect((await h.api.listMyRepairs()).map((r) => r.id)).toEqual([2, 1])
  })

  it('场馆不存在 NOT_FOUND；场地不属于该场馆或描述为空 VALIDATION_ERROR', async () => {
    const h = await as('zhangsan')
    await expectApiError(h.api.createRepair({ venueId: 99, description: 'x' }), 'NOT_FOUND')
    await expectApiError(h.api.createRepair({ venueId: 1, resourceId: 5, description: 'x' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.createRepair({ venueId: 1, description: ' ' }), 'VALIDATION_ERROR')
  })

  it('只能看到自己的报修；管理员列表限授权场馆，可按状态过滤', async () => {
    const h = await as('zhangsan')
    await h.api.createRepair({ venueId: 1, description: '网球馆问题' })
    await h.loginAs('lisi')
    await h.api.createRepair({ venueId: 2, description: '羽毛球馆问题' })
    expect(await h.api.listMyRepairs()).toHaveLength(1)
    await h.loginAs('admin_tennis')
    expect((await h.api.adminListRepairs()).items.map((r) => r.venueName)).toEqual(['网球馆'])
    await expectApiError(h.api.adminListRepairs({ venueId: 2 }), 'FORBIDDEN_SCOPE')
    await h.loginAs('sysadmin')
    expect((await h.api.adminListRepairs()).total).toBe(2)
    expect((await h.api.adminListRepairs({ status: 'RESOLVED' })).total).toBe(0)
  })

  it('状态只能 SUBMITTED → IN_PROGRESS → RESOLVED；可由 SUBMITTED 直接到 RESOLVED；逆向或重复 INVALID_STATE', async () => {
    const h = await as('zhangsan')
    await h.api.createRepair({ venueId: 1, description: 'a' })
    await h.api.createRepair({ venueId: 1, description: 'b' })
    await h.loginAs('admin_tennis')
    expect(await h.api.adminUpdateRepair(1, { status: 'IN_PROGRESS' })).toMatchObject({ status: 'IN_PROGRESS' })
    await expectApiError(h.api.adminUpdateRepair(1, { status: 'IN_PROGRESS' }), 'INVALID_STATE', { status: 'IN_PROGRESS' })
    expect(await h.api.adminUpdateRepair(1, { status: 'RESOLVED', resultNote: '已修复' })).toMatchObject({ status: 'RESOLVED', resultNote: '已修复' })
    await expectApiError(h.api.adminUpdateRepair(1, { status: 'IN_PROGRESS' }), 'INVALID_STATE')
    await expectApiError(h.api.adminUpdateRepair(1, { status: 'RESOLVED', resultNote: 'x' }), 'INVALID_STATE')
    expect(await h.api.adminUpdateRepair(2, { status: 'RESOLVED', resultNote: '直接解决' })).toMatchObject({ status: 'RESOLVED' })
    expect((await h.api.adminListLogs({ action: 'REPAIR_UPDATE' })).total).toBe(3)
  })

  it('RESOLVED 必须填 resultNote → VALIDATION_ERROR；越权 FORBIDDEN_SCOPE；不存在 NOT_FOUND', async () => {
    const h = await as('lisi')
    await h.api.createRepair({ venueId: 2, description: 'x' })
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminUpdateRepair(1, { status: 'RESOLVED' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminUpdateRepair(1, { status: 'IN_PROGRESS' }), 'FORBIDDEN_SCOPE')
    await expectApiError(h.api.adminUpdateRepair(99, { status: 'IN_PROGRESS' }), 'NOT_FOUND')
  })
})
