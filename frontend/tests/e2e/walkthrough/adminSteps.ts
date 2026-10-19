// 演示主线第 4、7 步与 K4（docs/04 第 2 节；BE-8 裁决 K4）：场馆管理员端（1440×900）与权限隔离。
import { expect } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { DESKTOP } from '../browser/pageDriver'
import { makeHttpTarget } from '../support/httpTarget'
import { loginUi, shot, visit, type Walk } from './session'

export const DIALOG = '[role="dialog"]'

async function setCourtCount(walk: Walk): Promise<void> {
  const { page } = walk
  await visit(walk, '/venue-admin/resources?venueId=1')
  await page.waitForText('网球场4')
  await page.fill('场地数量', '5')
  await page.clickText('设定数量', { selector: 'button' })
  await page.waitForText('将场地数量设为 5')
  await shot(walk, '10-04b-resource-count-dialog')
  await page.clickText('确认', { within: DIALOG, selector: 'button' })
  await page.waitForText('网球场5')
}

// 设为维护：先预检受影响预约，选择“取消”并填写原因。
async function setMaintenance(walk: Walk): Promise<void> {
  const { page } = walk
  await page.clickText('设为维护：网球场1', { selector: 'button' })
  await page.waitForText('该操作会影响')
  await page.clickText('取消（CANCEL）', { within: DIALOG, selector: 'label', exact: false })
  await page.fill('原因（选择取消时必填）', '网球场1 球网维修（演示）')
  await shot(walk, '10-04c-maintenance-impact')
  await page.clickText('确认提交', { within: DIALOG, selector: 'button' })
  await page.waitForGone('该操作会影响')
  const admin = makeHttpTarget()
  await admin.loginAs('admin_tennis')
  const court = (await admin.api.adminListResources(1)).find((resource) => resource.name === '网球场1')
  expect(court?.operationalStatus).toBe('MAINTENANCE')
  await shot(walk, '10-04d-maintenance-applied')
}

async function reassignWangwu(walk: Walk): Promise<void> {
  const { page } = walk
  await visit(walk, '/venue-admin/reservations?venueId=1')
  await page.clickText('改派场地：王五', { selector: 'button', exact: false })
  await page.waitForText('目标场地')
  await page.setControl('目标场地', '网球场5', DIALOG)
  await page.setControl('开始时间', '11:00', DIALOG)
  await page.fill('改派原因（必填）', '网球场3 临时维护，改到网球场5（演示）')
  await shot(walk, '10-04e-reassign-dialog')
  await page.clickText('确认改派', { within: DIALOG, selector: 'button' })
  await page.waitForGone('确认改派')
  await page.waitForText('网球场3 临时维护，改到网球场5（演示）')
  await shot(walk, '10-04f-reservations-after')
}

export async function step4VenueAdmin(walk: Walk): Promise<void> {
  const { page } = walk
  await loginUi(walk, 'admin_tennis', DESKTOP)
  await visit(walk, '/venue-admin/occupancy?venueId=1')
  await page.setControl('日期', walk.tomorrow)
  await page.waitForText('王五')
  await shot(walk, '10-04a-occupancy')
  await setCourtCount(walk)
  await setMaintenance(walk)
  await reassignWangwu(walk)
}

// K4：每周窗口不是 90 分钟整数倍时，界面显示后端 RULE_INVALID 的 details.reason。只预检失败，不保存任何改动。
export async function k4RuleInvalid(walk: Walk): Promise<void> {
  const { page } = walk
  await visit(walk, '/venue-admin/resources?venueId=1')
  await page.waitForText('保存每周窗口')
  await page.setControl('关闭时间', '09:00')
  await page.clickText('保存每周窗口', { selector: 'button' })
  await page.waitForText('开放规则不合法：')
  await page.scrollTo('[role="alert"]')
  await shot(walk, '10-K4-rule-invalid')
  walk.record('k4-rule-invalid', { alert: await page.evaluate<string>('document.querySelector(\'[role="alert"]\').innerText') })
}

export async function step7Isolation(walk: Walk): Promise<void> {
  const { page } = walk
  const tennis = makeHttpTarget()
  await tennis.loginAs('admin_tennis')
  const error = await tennis.api.adminListResources(2).then(() => null, (cause: unknown) => cause)
  expect(error).toBeInstanceOf(ApiError)
  const apiError = error as ApiError
  expect([apiError.code, apiError.status]).toEqual(['FORBIDDEN_SCOPE', 403])
  walk.record('step7-va-other-venue', {
    call: 'GET /api/v1/admin/venues/2/resources (admin_tennis)', status: apiError.status, code: apiError.code,
    message: apiError.message, details: apiError.details,
  })
  const sys = makeHttpTarget()
  await sys.loginAs('sysadmin')
  walk.record('step7-sa-override', {
    call: 'GET /api/v1/admin/venues/2/resources (sysadmin)', resourceCount: (await sys.api.adminListResources(2)).length,
  })
  // 界面上场馆管理员只能选到授权场馆：地址里写 venueId=2 也回到网球馆（FE-5 S3），越权请求只能直接调接口得到 403。
  await loginUi(walk, 'admin_tennis', DESKTOP)
  await visit(walk, '/venue-admin/resources?venueId=2')
  await page.waitForText('网球场1')
  await shot(walk, '10-07a-va-only-own-venue')
  await loginUi(walk, 'sysadmin', DESKTOP)
  await visit(walk, '/sys-admin/reservations')
  await page.waitForText('泳道1')
  await shot(walk, '10-07b-sa-all-venues')
}
