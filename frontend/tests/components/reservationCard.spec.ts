// FE-3 预约卡片与取消确认层（FE-3-rulings 第 2 节按钮表、B1、B2、P3）：断言实际渲染出的按钮、禁用状态与区块。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { BookingRules, DisplayStatus, Reservation } from '../../src/api/types'
import CancelDialog from '../../src/components/reservation/CancelDialog.vue'
import ReservationCardView from '../../src/components/reservation/ReservationCard.vue'
import { buildCard } from '../../src/utils/reservationDisplay'
import { buttonByText, texts } from './support'

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 7, venueId: 1, venueName: '网球馆', resourceId: 1, resourceName: '网球场1', userId: 3, userDisplayName: '张三',
    serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
    purpose: null, createdAt: '2026-10-12T08:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
    adminNote: null, checkInAt: null, checkOutAt: null, ...overrides,
  }
}

interface CardOptions {
  busy?: boolean
  working?: boolean
  feedback?: string | null
  rules?: BookingRules | null
}

function mountCard(source: Reservation, options: CardOptions = {}) {
  return mount(ReservationCardView, {
    props: {
      card: buildCard(source, options.rules === undefined ? RULES : options.rules),
      busy: options.busy ?? false,
      working: options.working ?? false,
      feedback: options.feedback ?? null,
    },
  })
}

const CHECKED_IN = '2026-10-13T07:50:00'
const CHECKED_OUT = '2026-10-13T09:20:00'

// FE-3-rulings 第 2 节的每一行（以及“其他”里的每个状态）。
const BUTTON_TABLE: [string, Partial<Reservation>, string[]][] = [
  ['UPCOMING → 取消', { displayStatus: 'UPCOMING' }, ['取消预约']],
  ['CHECKIN_OPEN → 签到（不显示取消，B1）', { displayStatus: 'CHECKIN_OPEN' }, ['签到']],
  ['IN_USE → 签退', { displayStatus: 'IN_USE', checkInAt: CHECKED_IN }, ['签退']],
  ['COMPLETED 且已签到未签退 → 签退', { displayStatus: 'COMPLETED', checkInAt: CHECKED_IN }, ['签退']],
  ['COMPLETED 且未签到 → 无', { displayStatus: 'COMPLETED' }, []],
  ['COMPLETED 且已签退 → 无', { displayStatus: 'COMPLETED', checkInAt: CHECKED_IN, checkOutAt: CHECKED_OUT }, []],
  ['CHECKED_OUT → 无', { displayStatus: 'CHECKED_OUT', checkInAt: CHECKED_IN, checkOutAt: CHECKED_OUT }, []],
  ['NO_SHOW → 无', { displayStatus: 'NO_SHOW' }, []],
  ['CANCELLED → 无', { displayStatus: 'CANCELLED', status: 'CANCELLED' }, []],
  ['ADMIN_CANCELLED → 无', { displayStatus: 'ADMIN_CANCELLED', status: 'ADMIN_CANCELLED' }, []],
]

describe('ACC-M2-06 按钮表：实际渲染的按钮', () => {
  it.each(BUTTON_TABLE)('%s', (_title, overrides, labels) => {
    const card = mountCard(reservation(overrides))

    expect(texts(card, 'button')).toEqual(labels)
    expect(card.find('.actions').exists()).toBe(labels.length > 0)
  })

  it('每个状态都显示对应的中文状态名', () => {
    const names: [DisplayStatus, string][] = [
      ['UPCOMING', '待使用'], ['CHECKIN_OPEN', '可签到'], ['IN_USE', '使用中'], ['CHECKED_OUT', '已签退'],
      ['COMPLETED', '已完成'], ['NO_SHOW', '未到场'], ['CANCELLED', '已取消'], ['ADMIN_CANCELLED', '管理员已取消'],
    ]
    for (const [displayStatus, label] of names) {
      expect(mountCard(reservation({ displayStatus })).find('.badge').text()).toBe(label)
    }
  })

  it('点击按钮：向外发出对应的动作', async () => {
    const upcoming = mountCard(reservation({ displayStatus: 'UPCOMING' }))
    await buttonByText(upcoming, '取消预约').trigger('click')
    const open = mountCard(reservation({ displayStatus: 'CHECKIN_OPEN' }))
    await buttonByText(open, '签到').trigger('click')
    const inUse = mountCard(reservation({ displayStatus: 'IN_USE', checkInAt: CHECKED_IN }))
    await buttonByText(inUse, '签退').trigger('click')

    expect(upcoming.emitted('action')).toEqual([['CANCEL']])
    expect(open.emitted('action')).toEqual([['CHECK_IN']])
    expect(inUse.emitted('action')).toEqual([['CHECK_OUT']])
  })
})

describe('操作进行中：按钮不可用', () => {
  it('busy 为 true：所有按钮都有 disabled，点击不发出动作', async () => {
    const card = mountCard(reservation({ displayStatus: 'UPCOMING' }), { busy: true })

    const button = card.find('button')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(card.emitted('action')).toBeUndefined()
  })

  it('busy 为 false：按钮可用', () => {
    expect(mountCard(reservation()).find('button').attributes('disabled')).toBeUndefined()
  })

  it('本卡片的操作进行中：按钮文字变为“处理中…”且不可用', () => {
    const card = mountCard(reservation({ displayStatus: 'CHECKIN_OPEN' }), { busy: true, working: true })

    expect(texts(card, 'button')).toEqual(['处理中…'])
    expect(card.find('button').attributes('disabled')).toBeDefined()
  })

  it('别的卡片在操作：本卡片保持原文字，但也不可用', () => {
    const card = mountCard(reservation({ displayStatus: 'UPCOMING' }), { busy: true, working: false })

    expect(texts(card, 'button')).toEqual(['取消预约'])
    expect(card.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('管理员说明区块（P3）', () => {
  it('adminNote 非空：渲染“管理员说明”区块与内容', () => {
    const section = mountCard(reservation({ adminNote: '场地临时维护，已为您改派到网球场2' })).find('section.admin-note')

    expect(section.exists()).toBe(true)
    expect(section.attributes('aria-label')).toBe('管理员说明')
    expect(section.find('h3').text()).toBe('管理员说明')
    expect(section.find('p').text()).toBe('场地临时维护，已为您改派到网球场2')
  })

  it.each([
    ['null', null],
    ['空字符串', ''],
    ['只有空白', '   '],
  ])('adminNote 为%s：不渲染该区块', (_title, adminNote) => {
    const card = mountCard(reservation({ adminNote }))

    expect(card.find('section.admin-note').exists()).toBe(false)
    expect(card.text()).not.toContain('管理员说明')
  })
})

describe('卡片的其余字段（P3、P4）', () => {
  it('场馆 · 场地、日期、时间、预约人、状态', () => {
    const card = mountCard(reservation())

    expect(card.find('h2').text()).toBe('网球馆 · 网球场1')
    expect(texts(card, 'dt')).toEqual(['日期', '时间', '预约人'])
    expect(texts(card, 'dd')).toEqual(['2026-10-13 周二', '08:00–09:30', '张三'])
  })

  it('purpose 非空时才出现“用途”', () => {
    expect(texts(mountCard(reservation({ purpose: '周末练球' })), 'dt')).toContain('用途')
    expect(texts(mountCard(reservation({ purpose: '周末练球' })), 'dd')).toContain('周末练球')
    expect(texts(mountCard(reservation({ purpose: null })), 'dt')).not.toContain('用途')
  })

  it('签到与取消说明的数字来自规则；规则尚未取得时不显示说明', () => {
    expect(texts(mountCard(reservation()), '.notes li')).toEqual([
      '签到：开始前 15 分钟至开始后 15 分钟可签到；结束后 30 分钟内可签退',
      '取消：开始前至少 120 分钟可取消',
    ])
    expect(mountCard(reservation(), { rules: null }).find('.notes').exists()).toBe(false)
  })

  it('失败反馈：feedback 非空时显示为提示，为空时不显示', () => {
    const failed = mountCard(reservation(), { feedback: '已超过可取消时间' })
    expect(failed.find('[role="alert"]').text()).toBe('已超过可取消时间')
    expect(mountCard(reservation()).find('[role="alert"]').exists()).toBe(false)
  })
})

describe('取消确认层（B2）', () => {
  function mountDialog(options: { busy?: boolean; reason?: string } = {}) {
    return mount(CancelDialog, {
      props: {
        target: buildCard(reservation(), RULES), busy: options.busy ?? false, reason: options.reason ?? '',
      },
    })
  }

  it('显示标题、要取消的预约（场地、日期、时间）与可选原因输入', () => {
    const dialog = mountDialog()

    expect(dialog.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(dialog.find('h2').text()).toBe('确认取消预约？')
    expect(dialog.find('.what').text()).toContain('网球馆 · 网球场1')
    expect(dialog.find('.what').text()).toContain('2026-10-13 周二 08:00–09:30')
    expect(dialog.find('label').text()).toContain('取消原因（可选）')
    expect(texts(dialog, 'button')).toEqual(['再想想', '确认取消'])
  })

  it('输入原因：向外更新 reason', async () => {
    const dialog = mountDialog()
    await dialog.find('textarea').setValue('临时有事')

    expect(dialog.emitted('update:reason')).toEqual([['临时有事']])
  })

  it('“再想想”关闭，“确认取消”提交，二者互不触发', async () => {
    const closing = mountDialog()
    await buttonByText(closing, '再想想').trigger('click')
    expect(closing.emitted('dismiss')).toHaveLength(1)
    expect(closing.emitted('confirm')).toBeUndefined()

    const confirming = mountDialog()
    await buttonByText(confirming, '确认取消').trigger('click')
    expect(confirming.emitted('confirm')).toHaveLength(1)
    expect(confirming.emitted('dismiss')).toBeUndefined()
  })

  it('点击遮罩关闭，点击面板内部不关闭', async () => {
    const dialog = mountDialog()
    await dialog.find('.sheet').trigger('click')
    expect(dialog.emitted('dismiss')).toBeUndefined()

    await dialog.find('.backdrop').trigger('click')
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

  // TEST-2 D-01（裁决第 7 节第 1 条，FE-8 F1）：提交中不允许以任何方式关闭，“再想想”也不可用。
  it('操作进行中：“确认取消”不可用，点击不提交；“再想想”也不可用', async () => {
    const dialog = mountDialog({ busy: true })
    const confirm = buttonByText(dialog, '确认取消')

    expect(confirm.attributes('disabled')).toBeDefined()
    await confirm.trigger('click')
    expect(dialog.emitted('confirm')).toBeUndefined()
    expect(buttonByText(dialog, '再想想').attributes('disabled')).toBeDefined()
  })
})
