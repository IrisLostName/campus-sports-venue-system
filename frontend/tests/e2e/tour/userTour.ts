// TEST-2 W1 用户端（393×852 iPhone 16 竖屏，浅色与深色）：登录、首页无/有预约、订场（含“暂未开放预约”）、确认与成功、
// 预约页 UPCOMING 与取消层、历史 CANCELLED、带 admin_note 的改派、ADMIN_CANCELLED、报修、“我的”滚到底；另补 375×812 关键页。
// 数据（重置后的库，“明天”为服务端日期 + 1）：种子 zhangsan 明天 网球场1 08:00、lisi 明天 网球场2 09:30；
// wangwu 在界面上订明天 网球场3 11:00；zhaoliu 经 http 客户端订明天 网球场4 12:30（纯前置数据），由管理员在界面上改派。
import { expect } from 'vitest'

import { IPHONE16, MOBILE } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'
import { makeHttpTarget } from '../support/httpTarget'
import { openVenueSlots, pickSlot } from '../walkthrough/session'
import { capture, go, login, type Theme, type Tour } from './tourSession'

const BOTH: Theme[] = ['light', 'dark']

export async function userLoginAndEmpty(tour: Tour): Promise<void> {
  const { page } = tour
  await page.setViewport(IPHONE16)
  await page.clearLocalStorage(E2E.appUrl)
  await go(tour, '/login')
  await capture(tour, '01-user-login', { surface: 'login', expect: ['校园场馆预约系统', '用户名', '密码'], themes: BOTH })
  await login(tour, 'wangwu', IPHONE16)
  await capture(tour, '02-user-home-empty', {
    surface: 'user', expect: ['首页', '你还没有预约', '去订场', '系统公告'], absent: ['查看预约详情'], themes: BOTH,
  })
}

// 订场：场馆列表（羽毛球馆、游泳馆“暂未开放预约”，点了不进入时段步骤）→ 网球馆明天的时段与场馆公告 → 确认 → 成功。
export async function userBooking(tour: Tour): Promise<void> {
  const { page } = tour
  await page.clickText('去订场')
  await page.waitForText('网球馆')
  await page.clickText('羽毛球馆', { selector: 'button', exact: false })
  expect(await page.text(), '未开放场馆不进入时段步骤').not.toContain('← 重选场馆')
  await capture(tour, '03-user-booking-venues', { surface: 'user', expect: ['订场', '网球馆', '暂未开放预约'], themes: BOTH })
  await openVenueSlots(tour, '网球馆', '网球场1')
  await capture(tour, '04-user-booking-slots', { surface: 'user', expect: ['网球馆', '场馆公告', '网球场1', '已被预约'], themes: BOTH })
  await pickSlot(tour, '网球场3', '11:00')
  await page.fill('用途（可选）', '周末约练（演示）')
  await capture(tour, '05-user-booking-confirm', {
    surface: 'user', expect: ['确认预约', '网球馆', '网球场3', tour.tomorrow, '11:00–12:30'], themes: BOTH,
  })
  await page.clickText('确认预约', { selector: 'button' })
  await capture(tour, '06-user-booking-success', { surface: 'user', expect: ['预约成功', '查看预约', '回到首页'], themes: BOTH })
}

// zhangsan：首页摘要 → 预约页（UPCOMING，取消可用）→ 取消层 → 取消后“我的”历史里是“已取消”。
export async function userReservationAndCancel(tour: Tour): Promise<void> {
  const { page } = tour
  await login(tour, 'zhangsan', IPHONE16)
  await capture(tour, '07-user-home-summary', {
    surface: 'user', expect: ['首页', '查看预约详情', '网球馆 · 网球场1', '08:00–09:30', '张三', '待使用', '系统公告'], themes: BOTH,
  })
  await page.clickText('查看预约详情')
  await capture(tour, '08-user-reservation-upcoming', {
    surface: 'user', expect: ['预约', '待使用', '取消预约', '开始前至少 120 分钟可取消'], absent: ['已过可取消时间'], themes: BOTH,
  })
  await page.clickText('取消预约', { selector: 'button' })
  await page.fill('取消原因（可选）', '临时有事（演示）')
  await capture(tour, '09-user-cancel-sheet', { surface: 'user', expect: ['确认取消预约？', '再想想', '确认取消'], themes: BOTH })
  await page.clickText('确认取消', { selector: 'button' })
  // FE-3 B3：成功后卡片换成接口返回的预约（已取消、没有按钮），刷新后才离开当前列表。
  await page.waitFor('document.querySelector(\'article[data-status="CANCELLED"]\')', '卡片变为已取消')
  await go(tour, '/me')
  await capture(tour, '10-user-me-history-cancelled', {
    surface: 'user', expect: ['我的', '历史预约', '网球馆 · 网球场1', '已取消'], themes: BOTH,
  })
}

// zhaoliu 的预约经 http 客户端创建（纯前置数据）；改派与管理员取消在场馆管理员端的界面上做（adminTour）。
export async function seedZhaoliu(tour: Tour): Promise<void> {
  const zhaoliu = makeHttpTarget()
  await zhaoliu.loginAs('zhaoliu')
  const slots = await zhaoliu.api.getVenueSlots(1, tour.tomorrow)
  const court = slots.resources.find((resource) => resource.resourceName === '网球场4')
  expect(court).toBeDefined()
  const reservation = await zhaoliu.api.createReservation({
    resourceId: court?.resourceId ?? 0, serviceDate: tour.tomorrow, startTime: '12:30',
  })
  tour.record('setup-zhaoliu', { via: 'http client', reservation })
}

export async function userSeesAdminChanges(tour: Tour): Promise<void> {
  const { page } = tour
  await login(tour, 'zhaoliu', IPHONE16)
  await go(tour, '/reservation')
  await page.waitForText('管理员说明')
  await page.scrollTo('section[aria-label="管理员说明"]')
  await capture(tour, '11-user-reservation-admin-note', {
    surface: 'user', expect: ['管理员说明', '网球馆 · 网球场3', '12:30–14:00', '网球场4 灯光检修，改到网球场3（演示）'], themes: BOTH,
  })
  await login(tour, 'lisi', IPHONE16)
  await go(tour, '/me')
  await page.waitForText('管理员已取消')
  await capture(tour, '12-user-me-history-admin-cancelled', {
    surface: 'user', expect: ['历史预约', '管理员已取消', '管理员说明', '网球场2 地面维修（演示）'], themes: BOTH,
  })
}

// wangwu：提交报修 → “我的报修”出现“已提交”；随后“我的”滚到底。
export async function userRepair(tour: Tour): Promise<void> {
  const { page } = tour
  await login(tour, 'wangwu', IPHONE16)
  await go(tour, '/me')
  await page.setControl('场馆', '网球馆')
  await page.fill('问题描述', '网球场3 南侧灯光不亮（演示）')
  await page.clickText('提交报修', { selector: 'button[type="submit"]' })
  await page.waitForText('报修已提交')
  await page.scrollTo('form[aria-label="提交报修"]')
  await capture(tour, '13-user-me-repair', {
    surface: 'user', expect: ['报修已提交', '我的报修', '网球场3 南侧灯光不亮（演示）', '已提交'], themes: BOTH,
  })
  await capture(tour, '14-user-me-scrolled-bottom', {
    surface: 'user', expect: ['我的报修', '已提交'], themes: BOTH, scrolledBottom: true,
  })
}

// 375×812 浅色关键页（wangwu：此时有一条明天 11:00 的预约）。
export async function userMobile375(tour: Tour): Promise<void> {
  const { page } = tour
  await page.setViewport(MOBILE)
  await go(tour, '/me')
  await page.clickText('退出登录')
  await page.waitFor('location.pathname === "/login"', '退出后回到登录页')
  await capture(tour, '15-user-login', { surface: 'login', expect: ['校园场馆预约系统', '用户名'] })
  await login(tour, 'wangwu', MOBILE)
  await capture(tour, '16-user-home', { surface: 'user', expect: ['查看预约详情', '网球馆 · 网球场3'] })
  await go(tour, '/reservation')
  await capture(tour, '17-user-reservation', { surface: 'user', expect: ['周末约练（演示）', '取消预约'] })
  await go(tour, '/booking')
  await openVenueSlots(tour, '网球馆', '网球场1')
  await capture(tour, '18-user-booking-slots', { surface: 'user', expect: ['场馆公告', '网球场1'] })
  await go(tour, '/me')
  await capture(tour, '19-user-me', { surface: 'user', expect: ['我的', '历史预约', '报修'] })
}
