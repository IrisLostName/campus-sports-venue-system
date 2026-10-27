// 月历的键盘移动（UI-3 裁决第 2 节“键盘可操作”）：漫游焦点在 31 个日期格之间移动，置灰的日期也能停留（读屏可听到说明）。
// 方向键 ±1 / ±7；Home、End 到本周第一天、最后一天（周一为第一天）；PageUp、PageDown 到范围的第一天、最后一天。
// 返回新的下标；不是移动键时返回 null。超出范围时停在边界。
import { nextTick, ref } from 'vue'

const STEPS: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

// weekday：当前日期是周几（0 = 周一 … 6 = 周日）。
export function nextFocusIndex(index: number, key: string, total: number, weekday: number): number | null {
  const clamp = (value: number) => Math.min(Math.max(value, 0), total - 1)
  const step = STEPS[key]
  if (step !== undefined) {
    return clamp(index + step)
  }
  switch (key) {
    case 'Home':
      return clamp(index - weekday)
    case 'End':
      return clamp(index + (6 - weekday))
    case 'PageUp':
      return 0
    case 'PageDown':
      return total - 1
    default:
      return null
  }
}

// 月历根元素与“把焦点移到第 index 格”（日期按钮带 data-index）。DOM 访问放在这里，组件只调用。
export function useGridFocus() {
  const root = ref<HTMLElement | null>(null)

  async function focusAt(index: number): Promise<void> {
    await nextTick()
    root.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus()
  }

  function bindRoot(element: unknown): void {
    root.value = element instanceof HTMLElement ? element : null
  }

  return { bindRoot, focusAt }
}
