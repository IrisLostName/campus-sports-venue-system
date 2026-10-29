// P2-1c 裁决第 2 节：签到码浮层组件——卡片内容、二维码与文字替代、滑动与指示点、关闭方式与焦点、单卡错误与重试、
// 平面图与缺图占位、减少动效时没有动画。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import CheckInCodeSheet from '../../src/components/reservation/CheckInCodeSheet.vue'
import type { CodeEntry } from '../../src/composables/checkInSheet'
import type { CheckInTicketView } from '../../src/utils/checkInDisplay'

const TICKETS: CheckInTicketView[] = [
  {
    id: 1, venueId: 1, venueName: '网球馆', place: '网球馆 · 网球场1', bookerText: '预约人 张三（zhangsan）', companionsText: null,
    dateText: '2026-10-13 周二', slotText: '08:00–09:30', usableText: '08:00–09:30（10:00 前签退）',
    windowText: '07:45–08:15', deadlineText: '08:15', statusLabel: '可签到', displayStatus: 'CHECKIN_OPEN',
  },
  {
    id: 3, venueId: 1, venueName: '网球馆', place: '网球馆 · 网球场3', bookerText: '预约人 张三（zhangsan）', companionsText: null,
    dateText: '2026-10-13 周二', slotText: '14:00–15:30', usableText: '14:00–15:30（16:00 前签退）',
    windowText: '13:45–14:15', deadlineText: '14:15', statusLabel: '待使用', displayStatus: 'UPCOMING',
  },
]

const READY: Record<number, CodeEntry> = {
  1: { state: 'ready', code: '7f3c9a2e-41d8-4b6a-9e15-2c8d0b6f4a91.1' },
  3: { state: 'error', message: '服务器开小差了，请稍后再试' },
}

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

function mountSheet(props: Partial<{ open: boolean; startIndex: number; entries: Record<number, CodeEntry> }> = {}) {
  const entries = props.entries ?? READY
  mounted = mount(CheckInCodeSheet, {
    props: {
      open: props.open ?? true, tickets: TICKETS, startIndex: props.startIndex ?? 0,
      entryOf: (id: number) => entries[id] ?? { state: 'loading' },
    },
    attachTo: document.body,
  })
  return mounted
}

function slides(sheet: VueWrapper) {
  return sheet.findAll('.slide')
}

describe('结构与卡片内容', () => {
  it('底部浮层是带标题的模态对话框；每个预约一张卡片', async () => {
    const sheet = mountSheet()
    await flushPromises()
    const dialog = sheet.get('[role="dialog"]')

    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(sheet.get(`#${dialog.attributes('aria-labelledby')}`).text()).toBe('签到码')
    expect(slides(sheet)).toHaveLength(2)
    expect(slides(sheet).map((slide) => slide.attributes('aria-label'))).toEqual(['第 1 张，共 2 张', '第 2 张，共 2 张'])
  })

  it('卡片：场馆 · 场地、预约人、状态、日期、预约时段、可使用时段、签到时间、签到截止、平面图', async () => {
    const sheet = mountSheet()
    await flushPromises()
    const first = slides(sheet)[0]

    expect(first?.get('h3').text()).toBe('网球馆 · 网球场1')
    expect(first?.get('.who').text()).toBe('预约人 张三（zhangsan）')
    expect(first?.get('.badge').text()).toBe('可签到')
    expect(first?.findAll('dt').map((node) => node.text())).toEqual(['日期', '预约时段', '可使用时段', '签到时间', '签到截止'])
    expect(first?.findAll('dd').map((node) => node.text())).toEqual([
      '2026-10-13 周二', '08:00–09:30', '08:00–09:30（10:00 前签退）', '07:45–08:15', '08:15',
    ])
    expect(first?.get('.plan h4').text()).toBe('场馆平面图')
    expect(first?.get('.plan img').attributes()).toMatchObject({ src: '/media/venues/1/floorplan.jpg', alt: '网球馆平面图' })
  })

  it('二维码是 SVG（白底深色模块），有文字替代，不用 v-html', async () => {
    const sheet = mountSheet()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPromises()
    const svg = slides(sheet)[0]?.get('svg.qr-svg')

    expect(svg?.attributes('role')).toBe('img')
    expect(svg?.attributes('aria-label')).toBe('签到二维码')
    expect(svg?.find('rect.paper').exists()).toBe(true)
    expect(svg?.get('path.ink').attributes('d')).toMatch(/^M\d+ \d+h1v1h-1z/)
    const sources = ['CheckInQr.vue', 'CheckInTicket.vue', 'CheckInCodeSheet.vue']
      .map((name) => readFileSync(resolve(`src/components/reservation/${name}`), 'utf8'))
    expect(sources.some((source) => /\sv-html=/.test(source))).toBe(false)
  })

  it('平面图缺图（加载失败）时显示“暂无平面图”占位', async () => {
    const sheet = mountSheet()
    await slides(sheet)[0]?.get('.plan img').trigger('error')

    expect(slides(sheet)[0]?.find('.plan img').exists()).toBe(false)
    expect(slides(sheet)[0]?.get('[data-placeholder="floorplan"]').text()).toBe('暂无平面图')
  })

  it('取码失败只影响该卡片：显示错误与“重试”，点重试发出 retry(id)；加载中显示提示', async () => {
    const sheet = mountSheet({ entries: { 1: { state: 'loading' }, 3: READY[3] as CodeEntry } })
    expect(slides(sheet)[0]?.text()).toContain('签到码加载中…')
    const failed = slides(sheet)[1]

    expect(failed?.get('[role="alert"]').text()).toContain('签到码获取失败：服务器开小差了，请稍后再试')
    await failed?.get('.code-error button').trigger('click')
    expect(sheet.emitted('retry')).toEqual([[3]])
  })
})

describe('滑动与指示点', () => {
  it('打开时定位到所点的那张：指示点与非当前卡片的 inert 跟随', async () => {
    const sheet = mountSheet({ startIndex: 1 })
    await flushPromises()

    expect(sheet.findAll('.dots .dot').map((dot) => dot.attributes('aria-current'))).toEqual([undefined, 'true'])
    expect(slides(sheet).map((slide) => slide.attributes('inert') !== undefined)).toEqual([true, false])
  })

  it('点指示点切换卡片；←/→ 也能切换，不越界', async () => {
    const sheet = mountSheet()
    await flushPromises()
    await sheet.findAll('.dots .dot')[1]?.trigger('click')
    expect(sheet.findAll('.dots .dot')[1]?.classes()).toContain('on')

    const carousel = sheet.get('.carousel')
    await carousel.trigger('keydown', { key: 'ArrowRight' })
    expect(sheet.findAll('.dots .dot')[1]?.classes()).toContain('on')
    await carousel.trigger('keydown', { key: 'ArrowLeft' })
    expect(sheet.findAll('.dots .dot')[0]?.classes()).toContain('on')
    expect(slides(sheet).map((slide) => slide.attributes('inert') !== undefined)).toEqual([false, true])
  })

  it('左右滑动（滚动吸附）后按滚动位置更新当前卡片', async () => {
    const sheet = mountSheet()
    await flushPromises()
    const element = sheet.get('.carousel').element as HTMLElement
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 393 })
    element.scrollLeft = 393
    await sheet.get('.carousel').trigger('scroll')
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await flushPromises()

    expect(sheet.findAll('.dots .dot').map((dot) => dot.classes().includes('on'))).toEqual([false, true])
  })

  it('只有一张时不显示指示点与滑动提示', async () => {
    mounted = mount(CheckInCodeSheet, {
      props: { open: true, tickets: [TICKETS[0] as CheckInTicketView], startIndex: 0, entryOf: () => ({ state: 'loading' }) },
      attachTo: document.body,
    })
    expect(mounted.find('.dots').exists()).toBe(false)
    expect(mounted.find('.swipe-hint').exists()).toBe(false)
  })
})

describe('关闭与焦点', () => {
  it('“关闭”按钮、点遮罩、Esc 都发出 close；点浮层内部不会', async () => {
    const sheet = mountSheet()
    await flushPromises()

    await sheet.get('[role="dialog"]').trigger('click')
    expect(sheet.emitted('close')).toBeUndefined()
    await sheet.get('button[aria-label="关闭"]').trigger('click')
    await sheet.get('[data-checkin-sheet]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(sheet.emitted('close')).toHaveLength(3)
  })

  it('打开时聚焦“关闭”；关闭后焦点回到打开它的按钮', async () => {
    const opener = document.createElement('button')
    opener.textContent = '出示签到码'
    document.body.append(opener)
    opener.focus()
    const sheet = mountSheet({ open: false })
    await sheet.setProps({ open: true })
    await flushPromises()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('关闭')

    await sheet.setProps({ open: false })
    await flushPromises()
    expect(document.activeElement).toBe(opener)
  })

  it('Tab 在浮层内循环：最后一个可聚焦元素之后回到第一个，Shift+Tab 反之', async () => {
    const sheet = mountSheet()
    await flushPromises()
    const dialog = sheet.get('[role="dialog"]')
    const focusable = [...(dialog.element as HTMLElement).querySelectorAll<HTMLElement>('button, [tabindex="0"]')]
      .filter((element) => element.closest('[inert]') === null)
    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement

    last.focus()
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    first.focus()
    await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})

describe('减少动效', () => {
  it('弹出动画与指示点过渡只在 prefers-reduced-motion: no-preference 下出现', () => {
    const source = readFileSync(resolve('src/components/reservation/CheckInCodeSheet.vue'), 'utf8')
    const style = /<style[^>]*>([\s\S]*)<\/style>/.exec(source)?.[1] ?? ''
    const [outside, inside] = style.split('@media (prefers-reduced-motion: no-preference)')
    expect(outside).not.toMatch(/transition|animation|transform/)
    expect(inside).toMatch(/transition/)
  })
})
