// 订场叠放层的行为（UI-3 裁决第 1 节、第 2 节“焦点管理”，供 components/booking/BookingLayer 使用）。
// 焦点：打开（或直接以最上层挂载）时聚焦层内的 [data-autofocus]，没有则聚焦层本身；
//       被上一层盖住时记下层内的焦点，重新露出（层深回到 0）时还原；记下的元素已不在页面上时退回初始目标。
// 上移：弹层被盖住时，量出它离本层顶部还有多远（lift，像素），组件据此把它整体上移到顶部，
//       让它的上缘从上一层（更高的时段层）后面露出来，看得出三层叠放；重新露出时归零。减少动效时组件把上移乘以 0。
import { nextTick, onMounted, ref, watch } from 'vue'

export interface LayerSource {
  open: () => boolean
  depth: () => number
  base: () => boolean
}

// 弹层根元素的上内边距之下，就是层能到达的最高处。
function distanceToTop(panel: HTMLElement): number {
  const root = panel.parentElement
  if (root === null) {
    return 0
  }
  const top = root.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(root).paddingTop || '0')
  return Math.max(0, Math.round(panel.getBoundingClientRect().top - top))
}

export function useBookingLayer(source: LayerSource) {
  const panel = ref<HTMLElement | null>(null)
  const lift = ref(0)
  let remembered: HTMLElement | null = null

  function focusInitial(): void {
    const root = panel.value
    const target = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root
    target?.focus({ preventScroll: true })
  }

  onMounted(() => {
    if (source.open() && !source.base() && source.depth() === 0) {
      focusInitial()
    }
  })

  watch(source.open, async (open) => {
    if (open && !source.base()) {
      await nextTick()
      focusInitial()
    }
  })

  // 被盖住：记下层内焦点，量出上移距离。默认在 DOM 更新前运行，此时层深的变换还没生效，量到的是未变换的位置。
  function cover(): void {
    const root = panel.value
    const active = document.activeElement
    remembered = root !== null && active instanceof HTMLElement && root.contains(active) ? active : null
    lift.value = root === null || source.base() ? 0 : distanceToTop(root)
  }

  // 重新露出：上移归零，还原焦点。
  async function uncover(): Promise<void> {
    lift.value = 0
    await nextTick()
    if (remembered?.isConnected === true) {
      remembered.focus({ preventScroll: true })
    } else if (!source.base()) {
      focusInitial()
    }
  }

  watch(source.depth, async (depth, before) => {
    if (before === 0 && depth > 0) {
      cover()
    } else if (depth === 0 && before > 0) {
      await uncover()
    }
  })

  // 模板里用函数 ref 绑定层的根元素（:ref="bindPanel"）。
  function bindPanel(element: unknown): void {
    panel.value = element instanceof HTMLElement ? element : null
  }

  return { bindPanel, lift }
}
