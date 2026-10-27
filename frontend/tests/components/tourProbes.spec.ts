// UI-3 裁决第 6 节 F1：巡检测量函数 layoutProbe、targetProbe 排除 [inert] 子树，并对订场的叠放层（role="dialog"、无 aria-modal）
// 以最上层弹层的底边判断“最后一项不被 Dock 压住”。没有 [inert] 与叠放层的页面，结果须与改动前逐字段相同——
// 下面的 baseline* 是改动前（提交 6a7dc57）这两个函数的原样副本，在同一批页面上对比。
// happy-dom 不做布局：用 data-rect="左 上 宽 高" 给元素指定位置，没有 data-rect 的元素宽高为 0（视为不可见）。
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { layoutProbe, targetProbe, type LayoutReport, type TargetReport } from '../e2e/browser/pageScripts'

// ---- 改动前的原样副本（只用于对比，不参与巡检） ----
function baselineLayoutProbe(): LayoutReport {
  const visible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const doc = document.documentElement
  const content = document.querySelector('main.content')
  const dock = document.querySelector('nav[aria-label="主导航"]')
  const modal = document.querySelector('[aria-modal="true"]')
  const inOverlay = (el: Element): boolean => modal !== null && (el.contains(modal) || modal.contains(el)
    || (modal.parentElement !== null && modal.parentElement.contains(el)))
  let lastBottom: number | null = null
  if (content !== null) {
    const saved = content.scrollTop
    content.scrollTop = content.scrollHeight
    lastBottom = Math.max(0, ...[...content.querySelectorAll('*')].filter((el) => visible(el) && !inOverlay(el))
      .map((el) => Math.round(el.getBoundingClientRect().bottom)))
    content.scrollTop = saved
  }
  const ownText = (el: Element): boolean => [...el.childNodes]
    .some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
  const fonts = [...document.querySelectorAll('body *')].filter((el) => ownText(el) && visible(el))
    .map((el) => parseFloat(getComputedStyle(el).fontSize))
  return {
    pageOverflowX: doc.scrollWidth - doc.clientWidth,
    contentOverflowX: content === null ? 0 : content.scrollWidth - content.clientWidth,
    dockTop: dock === null ? null : Math.round(dock.getBoundingClientRect().top),
    lastBottom,
    modalBottom: modal === null ? null : Math.round(modal.getBoundingClientRect().bottom),
    viewportHeight: innerHeight,
    minFontPx: fonts.length === 0 ? 0 : Math.min(...fonts),
  }
}

function baselineTargetProbe(args: { minSize: number }): TargetReport {
  const selector = 'button, a[href], [role="button"], [role="tab"], [role="option"], [role="radio"], [role="switch"], '
    + 'summary, input:not([type="hidden"]), select, textarea'
  const area = (el: Element): Element => (el.matches('input, select, textarea') ? el.closest('label') ?? el : el)
  const name = (el: Element): string => `${el.tagName.toLowerCase()}「${((el as HTMLElement).innerText
    || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24)}」`
  const inViewport = (rect: DOMRect): boolean => rect.width > 0 && rect.height > 0
    && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
  const modal = document.querySelector('[aria-modal="true"]')
  const targets = [...new Set([...document.querySelectorAll(selector)].map(area))]
    .filter((el) => getComputedStyle(el).visibility !== 'hidden' && inViewport(el.getBoundingClientRect())
      && (modal === null || modal.contains(el)))
  const small = targets.filter((el) => {
    const rect = el.getBoundingClientRect()
    return rect.width < args.minSize - 0.5 || rect.height < args.minSize - 0.5
  }).map((el) => {
    const rect = el.getBoundingClientRect()
    return `${name(el)} ${Math.round(rect.width)}×${Math.round(rect.height)}`
  })
  const inDock = (el: Element): boolean => el.closest('nav[aria-label="主导航"]') !== null
  const overlaps: string[] = []
  targets.forEach((a, i) => targets.slice(i + 1).forEach((b) => {
    if (a.contains(b) || b.contains(a) || inDock(a) !== inDock(b)) {
      return
    }
    const r1 = a.getBoundingClientRect()
    const r2 = b.getBoundingClientRect()
    const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left)
    const h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top)
    if (w > 1 && h > 1) {
      overlaps.push(`${name(a)} × ${name(b)}`)
    }
  }))
  return { count: targets.length, small, overlaps }
}
// ---- 副本结束 ----

const original = Element.prototype.getBoundingClientRect

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function rect(this: Element): DOMRect {
    const [x = 0, y = 0, w = 0, h = 0] = (this.getAttribute('data-rect') ?? '').split(' ').filter(Boolean).map(Number)
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect
  }
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = original
  document.body.innerHTML = ''
})

const DOCK = '<nav aria-label="主导航" data-rect="40 772 300 60"><a href="/" data-rect="50 778 60 48">首页</a></nav>'

// 普通用户端页面：两个互相重叠的按钮、一个过小的按钮、一个 label 包住的输入框，最后一项底边 700。
const PLAIN = `<main class="content"><section data-rect="0 0 393 700">
  <button data-rect="16 100 120 48">甲</button><button data-rect="100 110 120 48">乙</button>
  <button data-rect="16 300 30 30">小</button>
  <label data-rect="16 400 300 60">用途<input data-rect="20 420 280 30"></label>
  <p data-rect="16 650 300 50">最后一项</p></section></main>${DOCK}`

// 打开着 aria-modal 的取消层：只有浮层里的元素可点；浮层底边单独判断。
const MODAL = `<main class="content"><section data-rect="0 0 393 600"><button data-rect="16 500 300 48">卡片按钮</button></section>
  <div class="backdrop" data-rect="0 0 393 852"><div role="dialog" aria-modal="true" data-rect="0 452 393 400">
  <button data-rect="16 500 300 48">确认取消</button><button data-rect="16 560 300 48">再想想</button></div></div></main>${DOCK}`

// 订场叠放层：第一层与月历层 inert（按钮位置与时段层重叠），时段层是最上层，层内内容滚到 1622，层底边 764。
const STACKED = `<main class="content"><section class="page" data-rect="0 0 393 760">
  <div class="layer-base" inert data-rect="10 0 373 1400"><button class="venue" data-rect="16 80 360 300">网球馆</button>
    <button class="venue" data-rect="16 420 360 300">羽毛球馆</button><p data-rect="16 1300 300 100">游泳馆</p></div>
  <div class="layer-root" data-rect="0 0 393 772"><div role="dialog" aria-label="选择日期" inert data-rect="12 12 369 430">
    <button data-date="2026-10-28" data-rect="60 120 48 48">28</button><button data-rect="290 30 80 44">重选场馆</button></div></div>
  <div class="layer-root" data-rect="0 0 393 772"><div role="dialog" aria-label="网球馆 时段" data-rect="12 56 369 708">
    <button class="change-date" data-rect="280 70 90 44">更改日期</button>
    <button class="cell" data-rect="30 300 150 52">08:00–09:30</button><button class="cell" data-rect="30 1570 150 52">18:30–20:00</button>
  </div></div></section></main>${DOCK}`

function render(html: string): void {
  document.body.innerHTML = html
}

describe('没有 [inert] 与叠放层的页面：与改动前逐字段相同', () => {
  it.each([['普通页面', PLAIN], ['打开着 aria-modal 浮层', MODAL], ['只有 Dock（无内容区）', DOCK]])('%s', (_name, html) => {
    render(html)
    expect(layoutProbe()).toEqual(baselineLayoutProbe())
    expect(targetProbe({ minSize: 44 })).toEqual(baselineTargetProbe({ minSize: 44 }))
  })

  it('对比本身有效：普通页面测出重叠、过小与最后一项底边 700，浮层页只计浮层里的两个按钮', () => {
    render(PLAIN)
    expect(targetProbe({ minSize: 44 }).overlaps).toEqual(['button「甲」 × button「乙」'])
    expect(targetProbe({ minSize: 44 }).small).toEqual(['button「小」 30×30'])
    expect(layoutProbe().lastBottom).toBe(700)
    render(MODAL)
    expect(targetProbe({ minSize: 44 }).count).toBe(2)
    expect(layoutProbe().modalBottom).toBe(852)
  })
})

describe('订场叠放层', () => {
  it('改动前的口径在这里误判（审计 F1 的现象）：inert 的按钮算重叠，层内滚动的末项 1622 算被 Dock 压住', () => {
    render(STACKED)
    expect(baselineTargetProbe({ minSize: 44 }).overlaps.length).toBeGreaterThan(0)
    expect(baselineLayoutProbe().lastBottom).toBe(1622)
  })

  it('现在：inert 子树不计入可点击元素，没有重叠；只剩时段层里在视口内的两个按钮', () => {
    render(STACKED)
    const targets = targetProbe({ minSize: 44 })
    expect(targets.overlaps).toEqual([])
    expect(targets.count).toBe(2)
    expect(targets.small).toEqual([])
  })

  it('现在：“最后一项”取最上层弹层的底边 764（不高于 Dock 顶边 772），inert 的层、层内滚动的内容与层的底板（父元素）不计入', () => {
    render(STACKED)
    const layout = layoutProbe()
    expect(layout.lastBottom).toBe(764)
    expect(layout.dockTop).toBe(772)
    expect(layout.modalBottom).toBeNull()
  })

  it('最上层弹层越过 Dock 顶边时仍判出来', () => {
    render(STACKED.replace('data-rect="12 56 369 708"', 'data-rect="12 56 369 760"'))
    expect(layoutProbe().lastBottom).toBe(816)
  })

  it('只有第一层 inert、月历层在最上层时，以月历层底边为准', () => {
    render(STACKED.replace(/<div class="layer-root" data-rect="0 0 393 772"><div role="dialog" aria-label="网球馆 时段"[\s\S]*?<\/div><\/div>/, '')
      .replace('aria-label="选择日期" inert', 'aria-label="选择日期"'))
    expect(layoutProbe().lastBottom).toBe(760)
    expect(targetProbe({ minSize: 44 }).count).toBe(2)
  })
})
