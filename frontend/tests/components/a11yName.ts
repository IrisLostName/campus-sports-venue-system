// 可访问名称的简化计算（FE-8 L11，W3C accname 的常用子集），只用在组件测试里，不依赖浏览器的无障碍树：
// 1. aria-labelledby 指向的元素文字；2. aria-label；3. 输入控件的 <label>（for 或包裹）文字；
// 4. 按钮 / 链接等的内容文字（跳过 aria-hidden 的子树）；5. title。
// 真实浏览器的无障碍树另在 docs/evidence/FE-8-polish.md 里用 DevTools 协议核对。

const FORM_CONTROLS = ['input', 'select', 'textarea']

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function isHidden(node: Element): boolean {
  return node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')
}

// 子树里的文字：跳过隐藏的子树，以及 skip 指定的元素（包裹在 <label> 里的控件本身）。
function textOf(node: Node, skip: Element | null): string {
  if (node.nodeType === 3) {
    return node.textContent ?? ''
  }
  if (!(node instanceof Element) || isHidden(node) || node === skip) {
    return ''
  }
  return Array.from(node.childNodes).map((child) => textOf(child, skip)).join(' ')
}

function labelTextOf(control: Element): string {
  const root = control.getRootNode() as ParentNode
  const id = control.getAttribute('id')
  const labels = new Set<Element>()
  if (id !== null && id !== '') {
    root.querySelectorAll(`label[for="${id}"]`).forEach((label) => labels.add(label))
  }
  const wrapping = control.closest('label')
  if (wrapping !== null) {
    labels.add(wrapping)
  }
  return normalizeText(Array.from(labels).map((label) => textOf(label, control)).join(' '))
}

export function accessibleName(element: Element): string {
  const root = element.getRootNode() as ParentNode
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy !== null) {
    const text = labelledBy.split(/\s+/).map((id) => {
      const target = root.querySelector(`[id="${id}"]`)
      return target === null ? '' : textOf(target, null)
    }).join(' ')
    if (normalizeText(text) !== '') {
      return normalizeText(text)
    }
  }
  const label = normalizeText(element.getAttribute('aria-label') ?? '')
  if (label !== '') {
    return label
  }
  if (FORM_CONTROLS.includes(element.tagName.toLowerCase())) {
    const fromLabel = labelTextOf(element)
    if (fromLabel !== '') {
      return fromLabel
    }
  }
  const content = normalizeText(textOf(element, null))
  return content !== '' ? content : normalizeText(element.getAttribute('title') ?? '')
}
