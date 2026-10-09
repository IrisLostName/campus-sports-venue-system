// FE-6 G4：系统公告。scope=SYSTEM 的列表（含归档、状态筛选、分页）、发布（不带 venueId）、归档。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { createSysAnnouncements } from '../../src/composables/sysAnnouncements'
import { loginAdmin, spyOn } from '../admin/harness'

async function openBoard() {
  const ctx = await loginAdmin('sysadmin')
  const spy = spyOn(ctx.api)
  const board = createSysAnnouncements({ api: spy.client, call: ctx.call })
  await board.load()
  return { ctx, spy, board }
}

function callsOf(spy: ReturnType<typeof spyOn>, method: string) {
  return spy.calls.filter((call) => call.method === method).map((call) => call.args)
}

describe('G4 列表', () => {
  it('只查系统公告：scope=SYSTEM，不带 venueId；每行都可归档（生效中）', async () => {
    const { board, spy } = await openBoard()

    expect(callsOf(spy, 'adminListAnnouncements')).toEqual([[{ scope: 'SYSTEM', page: 1 }]])
    expect(board.rows.value.map((row) => [row.title, row.scopeLabel, row.statusLabel, row.canArchive])).toEqual([
      ['欢迎使用校园场馆预约系统', '系统公告', '生效中', true],
    ])
  })

  it('状态筛选带上 status 并回到第 1 页；已归档的没有归档按钮', async () => {
    const { board, spy } = await openBoard()
    await board.setStatus('ARCHIVED')

    expect(callsOf(spy, 'adminListAnnouncements').at(-1)).toEqual([{ scope: 'SYSTEM', page: 1, status: 'ARCHIVED' }])
    expect(board.rows.value).toEqual([])
  })
})

describe('G4 发布', () => {
  it('发布系统公告：请求 scope=SYSTEM、不带 venueId；表单清空；列表刷新；用户端能看到', async () => {
    const { ctx, board, spy } = await openBoard()
    Object.assign(board.form, { title: ' 国庆开放时间 ', content: ' 假期照常开放 ', expiresAt: '2026-12-31T08:00' })
    await board.publish()

    expect(callsOf(spy, 'adminCreateAnnouncement')).toEqual([[{
      scope: 'SYSTEM', title: '国庆开放时间', content: '假期照常开放', expiresAt: '2026-12-31T08:00:00',
    }]])
    expect(board.notice.value).toBe('公告已发布')
    expect(board.form).toEqual({ title: '', content: '', expiresAt: '' })
    expect(board.rows.value.map((row) => row.title)).toContain('国庆开放时间')
    const zhangsan = await ctx.h.clientFor('zhangsan')
    expect((await zhangsan.listAnnouncements({ scope: 'SYSTEM' })).map((item) => item.title)).toContain('国庆开放时间')
  })

  it('不填过期时间时不发送 expiresAt', async () => {
    const { board, spy } = await openBoard()
    Object.assign(board.form, { title: '标题', content: '内容' })
    await board.publish()

    expect(callsOf(spy, 'adminCreateAnnouncement')).toEqual([[{ scope: 'SYSTEM', title: '标题', content: '内容' }]])
  })

  it('标题或内容为空：提示，不发请求', async () => {
    const { board, spy } = await openBoard()
    await board.publish()
    expect(board.formError.value).toBe('请填写标题')
    board.form.title = '标题'
    await board.publish()
    expect(board.formError.value).toBe('请填写内容')
    expect(callsOf(spy, 'adminCreateAnnouncement')).toEqual([])
  })

  it('接口拒绝（标题超长）：表单保留并显示接口文案', async () => {
    const { board } = await openBoard()
    Object.assign(board.form, { title: '长'.repeat(101), content: '内容' })
    await board.publish()

    expect(board.formError.value).toBe('请求参数不合法')
    expect(board.form.content).toBe('内容')
  })
})

describe('G4 归档', () => {
  it('先确认再归档：用户端不再显示；“已归档”筛选里能看到且没有归档按钮', async () => {
    const { ctx, board, spy } = await openBoard()
    const id = board.rows.value[0]?.id ?? 0
    board.askArchive(id)
    expect(board.archive.value).toMatchObject({ id, title: '欢迎使用校园场馆预约系统' })
    expect(callsOf(spy, 'adminArchiveAnnouncement')).toEqual([])

    await board.confirmArchive()

    expect(callsOf(spy, 'adminArchiveAnnouncement')).toEqual([[id]])
    expect(board.archive.value).toBeNull()
    expect(board.notice.value).toBe('公告已归档')
    const zhangsan = await ctx.h.clientFor('zhangsan')
    expect(await zhangsan.listAnnouncements({ scope: 'SYSTEM' })).toEqual([])

    await board.setStatus('ARCHIVED')
    expect(board.rows.value.map((row) => [row.statusLabel, row.canArchive])).toEqual([['已归档', false]])
    board.askArchive(id)
    expect(board.archive.value).toBeNull()
  })

  it('取消确认：不归档', async () => {
    const { board, spy } = await openBoard()
    board.askArchive(board.rows.value[0]?.id ?? 0)
    board.dismissArchive()

    expect(board.archive.value).toBeNull()
    expect(callsOf(spy, 'adminArchiveAnnouncement')).toEqual([])
  })
})

describe('G4 X1 登录失效', () => {
  it('TOKEN_EXPIRED：回到登录页，不展示错误', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminListAnnouncements: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }
    const board = createSysAnnouncements({ api, call: ctx.call })
    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.error.value).toBeNull()
  })
})
