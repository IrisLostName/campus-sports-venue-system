// TEST-2 W1 场馆管理员端（admin_tennis）与系统管理员端（sysadmin）：每个导航项 1440×900 浅色，各抽 3 页另拍深色（待定项 8）。
// 先在场馆管理员端的界面上做两项管理员操作，作为用户端第 11、12 张截图的数据：
//   改派 zhaoliu 明天 网球场4 12:30 → 网球场3 12:30；取消 lisi 明天 网球场2 09:30（原因必填）。
import { DESKTOP } from '../browser/pageDriver'
import { DIALOG } from '../walkthrough/adminSteps'
import { loginUi, visit } from '../walkthrough/session'
import { capture, type Theme, type Tour } from './tourSession'

const BOTH: Theme[] = ['light', 'dark']
// 页面出现这些文字说明数据没加载好或出了错，截图前一律不得出现。
const NOT_READY = ['加载中…', '服务器开小差了']

export const REASSIGN_NOTE = '网球场4 灯光检修，改到网球场3（演示）'
export const CANCEL_NOTE = '网球场2 地面维修（演示）'

export async function adminActions(tour: Tour): Promise<void> {
  const { page } = tour
  await loginUi(tour, 'admin_tennis', DESKTOP)
  await visit(tour, '/venue-admin/reservations?venueId=1')
  await page.clickText('改派场地：赵六', { selector: 'button', exact: false })
  await page.waitForText('目标场地')
  await page.setControl('目标场地', '网球场3', DIALOG)
  await page.setControl('开始时间', '12:30', DIALOG)
  await page.fill('改派原因（必填）', REASSIGN_NOTE)
  await page.clickText('确认改派', { within: DIALOG, selector: 'button' })
  await page.waitForGone('确认改派')
  await page.waitForText(REASSIGN_NOTE)
  await page.clickText('取消：李四', { selector: 'button', exact: false })
  await page.waitForText('取消原因（必填）')
  await page.fill('取消原因（必填）', CANCEL_NOTE)
  await page.clickText('确认取消', { within: DIALOG, selector: 'button' })
  await page.waitForGone('取消原因（必填）')
  await page.waitForText(CANCEL_NOTE)
  tour.record('setup-admin-actions', { via: 'venue admin UI', reassigned: 'zhaoliu', cancelled: 'lisi' })
}

interface AdminPage {
  name: string
  path: string
  heading: string
  expect: string[]
  themes?: Theme[]
}

async function tourPages(tour: Tour, pages: AdminPage[]): Promise<void> {
  for (const item of pages) {
    await visit(tour, item.path)
    await capture(tour, item.name, {
      surface: 'admin', heading: item.heading, expect: item.expect, absent: NOT_READY, themes: item.themes,
    })
  }
}

export async function venueAdminPages(tour: Tour): Promise<void> {
  await loginUi(tour, 'admin_tennis', DESKTOP)
  await tourPages(tour, [
    { name: '20-va-overview', path: '/venue-admin?venueId=1', heading: '概览', expect: ['网球馆'], themes: BOTH },
    {
      name: '21-va-reservations', path: '/venue-admin/reservations?venueId=1', heading: '预约管理',
      expect: ['赵六', '李四', '管理员已取消', REASSIGN_NOTE, CANCEL_NOTE], themes: BOTH,
    },
    { name: '22-va-resources', path: '/venue-admin/resources?venueId=1', heading: '场地与开放规则', expect: ['网球场1', '保存每周窗口'] },
  ])
  await visit(tour, '/venue-admin/occupancy?venueId=1')
  await tour.page.setControl('日期', tour.tomorrow)
  await capture(tour, '23-va-occupancy', {
    surface: 'admin', heading: '场地占用总览', expect: ['网球场1', '王五', '赵六'], absent: NOT_READY, themes: BOTH,
  })
  await tourPages(tour, [
    { name: '24-va-announcements', path: '/venue-admin/announcements?venueId=1', heading: '公告', expect: ['发布场馆公告', '系统公告（只读）'] },
    { name: '25-va-repairs', path: '/venue-admin/repairs?venueId=1', heading: '报修', expect: ['网球场3 南侧灯光不亮（演示）'] },
    { name: '26-va-logs', path: '/venue-admin/logs?venueId=1', heading: '操作记录', expect: ['改派场地', REASSIGN_NOTE] },
  ])
}

export async function sysAdminPages(tour: Tour): Promise<void> {
  await loginUi(tour, 'sysadmin', DESKTOP)
  await tourPages(tour, [
    { name: '27-sa-venues', path: '/sys-admin', heading: '场馆资料与开关', expect: ['场馆列表', '网球馆', '游泳馆'], themes: BOTH },
    { name: '28-sa-admins', path: '/sys-admin/admins', heading: '管理员与授权', expect: ['admin_tennis', 'admin_pool'] },
    { name: '29-sa-users', path: '/sys-admin/users', heading: '用户', expect: ['zhangsan', 'wangwu'], themes: BOTH },
    { name: '30-sa-announcements', path: '/sys-admin/announcements', heading: '系统公告', expect: ['发布系统公告'] },
    { name: '31-sa-stats', path: '/sys-admin/stats', heading: '全局统计', expect: ['统计区间'], themes: BOTH },
    { name: '32-sa-logs', path: '/sys-admin/logs', heading: '操作记录', expect: ['改派场地'] },
    { name: '33-sa-reservations', path: '/sys-admin/reservations', heading: '预约管理', expect: ['赵六', '网球馆'] },
    { name: '34-sa-resources', path: '/sys-admin/resources?venueId=1', heading: '场地与开放规则', expect: ['网球场1'] },
    { name: '35-sa-occupancy', path: '/sys-admin/occupancy?venueId=1', heading: '场地占用总览', expect: ['网球场1'] },
    { name: '36-sa-venue-announcements', path: '/sys-admin/venue-announcements?venueId=1', heading: '公告', expect: ['发布场馆公告'] },
    { name: '37-sa-repairs', path: '/sys-admin/repairs', heading: '报修', expect: ['网球场3 南侧灯光不亮（演示）'] },
  ])
}
