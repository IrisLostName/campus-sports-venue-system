// UI-2a-rulings 第 4 节（ACC-M2-09）：挂载后的大屏页面（文字与属性，含图表的 aria-label）里没有任何用户的用户名或姓名。
import { describe, expect, it, vi } from 'vitest'

import { book, createHarness, setTime, TOMORROW } from '../api/support/harness'
import { installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

describe('不含个人信息', () => {
  it('有预约、签到与系统公告时，页面 HTML 中不出现任何用户名或姓名', async () => {
    const h = createHarness()
    await h.loginAs('wangwu')
    await book(h.api, 3, TOMORROW, '08:00')
    await h.loginAs('sysadmin')
    await h.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: '场馆开放时间调整', content: '内容' })
    const users = await h.api.adminListUsers({ pageSize: 100 })
    setTime(h, TOMORROW, '08:00')
    await h.loginAs('zhangsan')
    await h.api.checkIn(1)
    h.logout()
    const summary = await h.api.getDisplaySummary()

    const { page } = await mountDisplay([summary])
    const html = page.html()
    expect(page.findAll('li.metric')).toHaveLength(4)
    expect(page.text()).toContain('场馆开放时间调整')
    expect(users.items.length).toBeGreaterThan(5)
    for (const user of users.items) {
      expect(html.includes(user.username), `页面出现用户名 ${user.username}`).toBe(false)
      expect(html.includes(user.displayName), `页面出现姓名 ${user.displayName}`).toBe(false)
    }
  })
})
