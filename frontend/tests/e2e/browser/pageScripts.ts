// 在页面里执行的函数：以 Function.prototype.toString 传给 Runtime.evaluate，所以每个函数必须自包含（不引用模块内的其他名字）。
export interface Point {
  x: number
  y: number
}

export interface FindArgs {
  text: string
  selector: string
  exact: boolean
  nth: number
  within: string | null
}

// 按文字找可见元素（文字或 aria-label），取最内层的第 nth 个，滚动到视口中央并返回中心坐标。
export function findByText(args: FindArgs): Point | null {
  const norm = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()
  const visible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const texts = (el: Element): string[] => [norm((el as HTMLElement).innerText), norm(el.getAttribute('aria-label'))]
  const root = args.within === null ? document : document.querySelector(args.within)
  if (root === null) {
    return null
  }
  const matches = [...root.querySelectorAll(args.selector)].filter((el) => visible(el)
    && texts(el).some((text) => (args.exact ? text === args.text : text.includes(args.text))))
  const innermost = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)))
  const target = innermost[args.nth]
  if (target === undefined) {
    return null
  }
  target.scrollIntoView({ block: 'center', inline: 'center' })
  const rect = target.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

// 找到“标签文字”为 label 的表单控件（UiTextField 的 <label> 包住控件），聚焦并全选已有内容，返回中心坐标。
export function focusField(args: { label: string; nth: number }): Point | null {
  const ownText = (el: Element): string => [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? '').join('').trim()
  const labels = [...document.querySelectorAll('label')].filter((el) => ownText(el) === args.label
    && el.getBoundingClientRect().height > 0)
  const control = labels[args.nth]?.querySelector('input, textarea, select') as HTMLInputElement | null
  if (!control) {
    return null
  }
  control.scrollIntoView({ block: 'center' })
  control.focus()
  if (typeof control.select === 'function') {
    control.select()
  }
  const rect = control.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

// 原生 <select> 与日期/时间输入框：设值并派发 input、change（无头浏览器无法操作原生下拉与日期弹层，证据中说明）。
// <select> 按选项文字选择（完全相同，或以给定文字开头）；其余控件直接写入值。可限定在 within 选择器内（例如对话框）。
export function setControl(args: { label: string; value: string; within: string | null }): boolean {
  const ownText = (el: Element): string => [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? '').join('').trim()
  const root = args.within === null ? document : document.querySelector(args.within)
  const label = root ? [...root.querySelectorAll('label')].find((el) => ownText(el) === args.label) : undefined
  const control = label?.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | null | undefined
  if (!control) {
    return false
  }
  let value = args.value
  if (control instanceof HTMLSelectElement) {
    const option = [...control.options].find((item) => item.text.trim() === args.value || item.text.trim().startsWith(args.value))
    if (!option) {
      return false
    }
    value = option.value
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set
  setter?.call(control, value)
  control.dispatchEvent(new Event('input', { bubbles: true }))
  control.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

// TEST-2 布局测量（ACC-M2-10、docs/17 第 9 节）：横向溢出、滚到底时最后一项与 Dock 的关系、可见文字的最小字号。
// 用户端的内容区（main.content）自己滚动：先滚到底测最后一项的底边，再恢复原来的滚动位置，截图不受影响。
// UI-3（裁决第 6 节 F1）：[inert] 子树不可交互，不参与“被 Dock 压住”的判定；订场的叠放层是 role="dialog"、不加 aria-modal、
// 层内滚动——打开时以最上层（未 inert 的）弹层的底边作为“最后一项”，层内的内容按层内口径（由层自己的滚动保证）、
// 弹层的底板（父元素，同模态浮层的处理）都不再逐个计入。
// 页面上没有 [inert] 与这种叠放层时，结果与改动前完全相同。
export interface LayoutReport {
  pageOverflowX: number          // document 的 scrollWidth - clientWidth
  contentOverflowX: number       // 用户端内容区的 scrollWidth - clientWidth（没有内容区为 0）
  dockTop: number | null         // 用户端 Dock 顶边（没有 Dock 为 null）
  lastBottom: number | null      // 内容区滚到底后，内容区内可见元素的最大底边（不含打开着的模态浮层与 [inert] 子树；叠放层只计最上层的底边）
  modalBottom: number | null     // 打开着的模态浮层（aria-modal）的底边；浮层盖在 Dock 之上是设计，单独判断不超出视口
  viewportHeight: number
  minFontPx: number              // 有直接文字的可见元素中最小的计算字号
}

export function layoutProbe(): LayoutReport {
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
  const inert = (el: Element): boolean => el.closest('[inert]') !== null
  const layers = [...document.querySelectorAll('[role="dialog"]:not([aria-modal="true"])')].filter((el) => visible(el) && !inert(el))
  const topLayer = layers[layers.length - 1] ?? null
  const layerHosts = [...document.querySelectorAll('[role="dialog"]:not([aria-modal="true"])')].map((el): Element | null => el.parentElement)
  const inLayer = (el: Element): boolean => el.closest('[role="dialog"]:not([aria-modal="true"])') !== null || layerHosts.includes(el)
  let lastBottom: number | null = null
  if (content !== null) {
    const saved = content.scrollTop
    content.scrollTop = content.scrollHeight
    lastBottom = Math.max(0, ...[...content.querySelectorAll('*')]
      .filter((el) => visible(el) && !inOverlay(el) && !inert(el) && !inLayer(el))
      .map((el) => Math.round(el.getBoundingClientRect().bottom)),
    ...(topLayer === null ? [] : [Math.round(topLayer.getBoundingClientRect().bottom)]))
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

// TEST-2 大屏（1366×768 等）：选择器匹配到的面板两两不重叠（嵌套的不算），以及文档是否出现滚动条。
export interface PanelReport {
  panels: number
  overlaps: string[]
  scrollX: number                // scrollWidth - clientWidth
  scrollY: number                // scrollHeight - clientHeight
}

export function panelProbe(args: { selector: string }): PanelReport {
  const panels = [...document.querySelectorAll(args.selector)].filter((el) => el.getBoundingClientRect().width > 0)
  const label = (el: Element): string => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}「${
    ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 16)}」`
  const overlaps: string[] = []
  panels.forEach((a, i) => panels.slice(i + 1).forEach((b) => {
    if (a.contains(b) || b.contains(a)) {
      return
    }
    const r1 = a.getBoundingClientRect()
    const r2 = b.getBoundingClientRect()
    const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left)
    const h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top)
    if (w > 0.5 && h > 0.5) {
      overlaps.push(`${label(a)} × ${label(b)}`)
    }
  }))
  const doc = document.documentElement
  return { panels: panels.length, overlaps, scrollX: doc.scrollWidth - doc.clientWidth, scrollY: doc.scrollHeight - doc.clientHeight }
}

// TEST-2 可点击元素：数量、小于 minSize 的（docs/17 第 4 节触控 44×44）、互相重叠的。
// 表单控件以包住它的 <label> 为触控区域；嵌套关系（一个包含另一个）不算重叠；Dock 与内容区之间的遮挡由 layoutProbe 判断。
// UI-3（裁决第 6 节 F1）：[inert] 子树里的元素不可点，不计入（订场叠放层下面的层）；没有 [inert] 的页面结果与改动前相同。
export interface TargetReport {
  count: number
  small: string[]
  overlaps: string[]
}

export function targetProbe(args: { minSize: number }): TargetReport {
  const selector = 'button, a[href], [role="button"], [role="tab"], [role="option"], [role="radio"], [role="switch"], '
    + 'summary, input:not([type="hidden"]), select, textarea'
  const area = (el: Element): Element => (el.matches('input, select, textarea') ? el.closest('label') ?? el : el)
  const name = (el: Element): string => `${el.tagName.toLowerCase()}「${((el as HTMLElement).innerText
    || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24)}」`
  const inViewport = (rect: DOMRect): boolean => rect.width > 0 && rect.height > 0
    && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
  // 打开着模态浮层时，只有浮层里的元素可以点（遮罩挡住了其余部分）。
  const modal = document.querySelector('[aria-modal="true"]')
  const targets = [...new Set([...document.querySelectorAll(selector)].map(area))]
    .filter((el) => getComputedStyle(el).visibility !== 'hidden' && inViewport(el.getBoundingClientRect())
      && (modal === null || modal.contains(el)) && el.closest('[inert]') === null)
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
