<script setup lang="ts">
// 订场的叠放层（UI-3 裁决第 1 节、第 4 节第 4、5 条）：场馆 → 日期 → 时段三层，后一层压在前一层上。
// depth：0 为最上层；下面的层按层深略缩小、上移并变暗，且加 inert（不可聚焦、读屏不读）。
// base 为第一层（页面本身，不是弹层）；其余层是 role="dialog"（不加 aria-modal：各层停在 Dock 之上，Dock 保持可用）。
// 弹出：类似 iPhone 连接 AirPods 时的弹出卡片——自下而上弹起、略微越过再回落；关闭时下滑淡出。
// 动效数值是本组件的局部自定义属性（基于现有 --motion-*、--ease-* 令牌，不改 tokens.css）；减少动效时缩放、位移归零，只保留淡入淡出。
// 焦点：打开时聚焦层内的 [data-autofocus]（没有则聚焦层本身）；被上一层盖住时记下层内焦点，重新露出时还原（composables/bookingLayer）。
// 被时段层盖住的月历层整体上移到顶部（lift），上缘从时段层后面露出来，看得出三层叠放。
// Esc：只有最上层的浮层响应（composables/escapeClose），发出 close。
import { useEscapeClose } from '../../composables/escapeClose'
import { useBookingLayer } from '../../composables/bookingLayer'

const props = withDefaults(defineProps<{
  open?: boolean
  depth: number
  base?: boolean
  label?: string
  size?: 'auto' | 'tall'
}>(), {
  open: true,
  base: false,
  label: undefined,
  size: 'auto',
})

const emit = defineEmits<{ close: [] }>()

const { bindPanel, lift } = useBookingLayer({ open: () => props.open, depth: () => props.depth, base: () => props.base })

useEscapeClose(() => props.open && !props.base, () => emit('close'))

function onBackdrop(): void {
  if (props.depth === 0) {
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="base"
    :ref="bindPanel"
    class="booking-layer layer-base"
    :class="{ covered: depth > 0 }"
    :style="{ '--depth': depth }"
    :data-depth="depth"
    :inert="depth > 0"
    :aria-hidden="depth > 0 ? 'true' : undefined"
  >
    <slot />
  </div>
  <Transition
    v-else
    name="booking-layer"
  >
    <div
      v-if="open"
      class="booking-layer layer-root"
      :class="`layer-root--${size}`"
      :style="{ '--depth': depth }"
      @click.self="onBackdrop"
    >
      <div
        :ref="bindPanel"
        class="panel"
        :class="{ covered: depth > 0 }"
        role="dialog"
        :aria-label="label"
        tabindex="-1"
        :style="{ '--lift': `${lift}px` }"
        :data-depth="depth"
        :inert="depth > 0"
        :aria-hidden="depth > 0 ? 'true' : undefined"
      >
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 局部动效参数：弹簧时长取 --motion-slow 的 1.5 倍，层缩放步长 5%，上移步长 --space-3，暗度系数作用于 --color-scrim；
   --layer-lift-factor 把被盖住时的整体上移（--lift，由脚本量出）打开或关掉。 */
.booking-layer {
  --layer-spring-duration: calc(var(--motion-slow) * 1.5);
  --layer-spring-ease: var(--ease-standard);
  --layer-scale-step: 0.05;
  --layer-offset-step: calc(-1 * var(--space-3));
  --layer-dim: 0.6;
  --layer-lift-factor: 1;
}

/* 层深：下面的层缩小、上移、变暗（暗度用遮罩层叠加，不用 filter，以免影响玻璃的背景模糊）。 */
.layer-base,
.panel {
  position: relative;
  transform:
    translateY(calc(var(--depth) * var(--layer-offset-step) - var(--lift, 0px) * var(--layer-lift-factor)))
    scale(calc(1 - var(--depth) * var(--layer-scale-step)));
  transform-origin: top center;
  transition:
    transform var(--motion-slow) var(--ease-standard),
    opacity var(--motion-slow) var(--ease-standard);
}

.layer-base::after,
.panel::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-scrim);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-slow) var(--ease-standard);
}

.covered::after {
  opacity: min(1, calc(var(--depth) * var(--layer-dim)));
}

.layer-base {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 弹层定位在手机这一列之内、Dock 之上（不盖住 Dock，ACC-M2-10）。 */
.layer-root {
  position: fixed;
  inset: 0 0 calc(var(--dock-height) + var(--dock-offset) + env(safe-area-inset-bottom) + var(--space-2));
  z-index: calc(var(--z-dock) - 1);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  max-width: var(--phone-width);
  margin-inline: auto;
  padding: var(--space-6) var(--space-3) 0;
  animation: booking-layer-fade var(--motion-normal) var(--ease-standard) backwards;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 100%;
  overflow-y: auto;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border: var(--glass-border);
  border-radius: var(--radius-2xl);
  background-color: color-mix(in srgb, var(--color-surface) 88%, transparent);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-highlight), var(--glass-shadow);
  overscroll-behavior: contain;
}

.panel:focus {
  outline: none;
}

/* 时段层的上缘比月历层低一截，留出被盖住的月历层露出的位置。 */
.layer-root--tall {
  padding-top: calc(var(--space-6) + var(--space-8));
}

.layer-root--tall .panel {
  flex: 1;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .panel {
    background-color: color-mix(in srgb, var(--color-surface) 92%, transparent);
  }
}

@media (prefers-reduced-transparency: reduce) {
  .panel {
    background-color: var(--color-surface);
  }
}

@keyframes booking-layer-fade {
  from {
    opacity: 0;
  }
}

/* 弹簧弹出只在未要求减少动效时出现。 */
@media (prefers-reduced-motion: no-preference) {
  .layer-root .panel {
    animation: booking-layer-pop var(--layer-spring-duration) var(--layer-spring-ease) backwards;
  }

  @keyframes booking-layer-pop {
    0% {
      opacity: 0;
      transform: translateY(100%) scale(0.9);
    }

    55% {
      opacity: 1;
      transform: translateY(-3%) scale(1.01);
    }

    78% {
      transform: translateY(1%) scale(0.998);
    }

    100% {
      opacity: 1;
      transform: none;
    }
  }
}

/* 减少动效：没有任何缩放与位移，只保留淡入淡出（时长由令牌收到 --motion-fast 以内）。 */
@media (prefers-reduced-motion: reduce) {
  .booking-layer {
    --layer-scale-step: 0;
    --layer-offset-step: 0px;
    --layer-lift-factor: 0;
  }
}

/* 关闭：下滑并淡出（--slide-distance 在减少动效时为 0）。 */
.booking-layer-leave-active {
  transition: opacity var(--motion-normal) var(--ease-standard);
}

.booking-layer-leave-active .panel {
  transition: transform var(--motion-normal) var(--ease-standard);
}

.booking-layer-leave-to {
  opacity: 0;
}

.booking-layer-leave-to .panel {
  transform: translateY(var(--slide-distance));
}
</style>
