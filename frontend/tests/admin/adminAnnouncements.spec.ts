// FE-5 P6：公告管理。种子里有 1 条系统公告（id 1）和 1 条网球馆公告（id 2）。
import { describe, expect, it } from 'vitest'

import { createAdminAnnouncements } from '../../src/composables/adminAnnouncements'
import { buildAnnouncementRow, toExpiresAt } from '../../src/utils/announcementDisplay'
import { loginAdmin, spyOn } from './harness'

async function open(venueId = 1) {
  const ctx = await loginAdmin('admin_tennis')
  const spy = spyOn(ctx.api)
  const board = createAdminAnnouncements({ api: spy.client, call: ctx.call }, venueId)
  await board.load()
  return { ctx, board, calls: spy.calls }
}

describe('P6 展示口径', () => {
  it('归档按钮只给生效中的场馆公告', () => {
    const base = {
      id: 1, scope: 'VENUE' as const, venueId: 1, title: 't', content: 'c', status: 'ACTIVE' as const,
      publishedAt: '2026-10-12T09:00:00', publishedByName: '网球馆管理员', expiresAt: null,
    }

    expect(buildAnnouncementRow(base)).toMatchObject({ canArchive: true, scopeLabel: '场馆公告', statusLabel: '生效中', publishedText: '2026-10-12 09:00', expiresText: null })
    expect(buildAnnouncementRow({ ...base, status: 'ARCHIVED' })).toMatchObject({ canArchive: false, statusLabel: '已归档' })
    expect(buildAnnouncementRow({ ...base, scope: 'SYSTEM', venueId: null })).toMatchObject({ canArchive: false, scopeLabel: '系统公告' })
    expect(buildAnnouncementRow({ ...base, expiresAt: '2026-10-20T18:30:00' }).expiresText).toBe('2026-10-20 18:30')
  })

  it('datetime-local 补秒；空或格式不对为 undefined', () => {
    expect(toExpiresAt('2026-10-20T18:30')).toBe('2026-10-20T18:30:00')
    expect(toExpiresAt('')).toBeUndefined()
    expect(toExpiresAt('2026-10-20')).toBeUndefined()
  })
})

describe('P6 board', () => {
  it('场馆公告与系统公告各查一次：场馆公告带 venueId，系统公告只读', async () => {
    const { board, calls } = await open()

    expect(calls.map((call) => call.args[0])).toEqual([
      { scope: 'VENUE', venueId: 1, page: 1 },
      { scope: 'SYSTEM', page: 1 },
    ])
    expect(board.venueRows.value.map((row) => [row.id, row.canArchive])).toEqual([[2, true]])
    expect(board.systemRows.value.map((row) => [row.id, row.canArchive, row.scopeLabel])).toEqual([[1, false, '系统公告']])
    expect(board.systemTruncated.value).toBe(false)
  })

  it('发布：标题或内容为空不发请求', async () => {
    const { board, calls } = await open()
    await board.publish()
    expect(board.formError.value).toBe('请填写标题')
    board.form.title = '临时闭馆'
    await board.publish()
    expect(board.formError.value).toBe('请填写内容')

    expect(calls.some((call) => call.method === 'adminCreateAnnouncement')).toBe(false)
  })

  it('发布：scope=VENUE + venueId；不填过期时间则不带 expiresAt；成功后清空表单并刷新', async () => {
    const { board, calls } = await open()
    board.form.title = ' 临时闭馆 '
    board.form.content = '周三全天检修'
    await board.publish()

    expect(calls.find((call) => call.method === 'adminCreateAnnouncement')?.args).toEqual([
      { scope: 'VENUE', venueId: 1, title: '临时闭馆', content: '周三全天检修' },
    ])
    expect(board.notice.value).toBe('公告已发布')
    expect(board.form).toEqual({ title: '', content: '', expiresAt: '' })
    expect(board.venueRows.value.map((row) => row.title)).toEqual(['临时闭馆', '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
  })

  it('发布：过期时间补 :00 后一并发送', async () => {
    const { board, calls } = await open()
    board.form.title = 'a'
    board.form.content = 'b'
    board.form.expiresAt = '2026-10-20T18:30'
    await board.publish()

    expect(calls.find((call) => call.method === 'adminCreateAnnouncement')?.args[0]).toMatchObject({ expiresAt: '2026-10-20T18:30:00' })
    expect(board.venueRows.value[0]?.expiresText).toBe('2026-10-20 18:30')
  })

})

describe('P6 board（归档、筛选、越权）', () => {
  it('归档：先确认；确认后公告变为已归档，用户端不再看到；系统公告不能归档', async () => {
    const { ctx, board } = await open()
    board.askArchive(1)
    expect(board.archive.value).toBeNull()

    board.askArchive(2)
    expect(board.archive.value).toMatchObject({ id: 2, busy: false, error: null })
    board.dismissArchive()
    expect(board.archive.value).toBeNull()

    board.askArchive(2)
    await board.confirmArchive()
    expect(board.archive.value).toBeNull()
    expect(board.notice.value).toBe('公告已归档')
    expect(board.venueRows.value.map((row) => [row.id, row.statusLabel, row.canArchive])).toEqual([[2, '已归档', false]])
    expect(await ctx.api.listAnnouncements({ scope: 'VENUE', venueId: 1 })).toEqual([])
  })

  it('状态筛选带 status，并回到第一页', async () => {
    const { board, calls } = await open()
    await board.setStatus('ARCHIVED')

    expect(calls.slice(2).map((call) => call.args[0])).toEqual([
      { scope: 'VENUE', venueId: 1, page: 1, status: 'ARCHIVED' },
      { scope: 'SYSTEM', page: 1, status: 'ARCHIVED' },
    ])
    expect(board.venueRows.value).toEqual([])
  })

  it('越权场馆：FORBIDDEN_SCOPE 文案', async () => {
    const { board } = await open(2)

    expect(board.venueList.error.value).toBe('无权操作该场馆')
  })

  it('发布被拒绝（越权场馆）：错误显示在表单', async () => {
    const { board } = await open(2)
    board.form.title = 'a'
    board.form.content = 'b'
    await board.publish()

    expect(board.formError.value).toBe('无权操作该场馆')
    expect(board.form.title).toBe('a')
  })
})
