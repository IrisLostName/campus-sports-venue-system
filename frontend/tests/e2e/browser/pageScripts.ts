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
