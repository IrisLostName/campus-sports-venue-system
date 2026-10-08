<script setup lang="ts">
// 底部面板（docs/17 第 6 节，用户端取消确认层）。open 为 false 时什么都不渲染。
// 点遮罩发出 dismiss；点面板内部不会。只有进入动画（自下而上滑入并淡入），不处理 Esc。
// 不使用 Teleport：浮层是 position: fixed，只要不放进带 backdrop-filter 的祖先（例如 UiGlassCard）里，就按视口定位。
import { useId } from 'vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  placement?: 'bottom' | 'center'
}>(), {
  placement: 'bottom',
})

defineEmits<{ dismiss: [] }>()

const titleId = useId()
</script>

<template>
  <Transition
    name="ui-sheet"
    appear
  >
    <div
      v-if="open"
      class="backdrop"
      :class="`backdrop--${placement}`"
      @click.self="$emit('dismiss')"
    >
      <div
        class="sheet ui-glass ui-glass--thick"
        :class="`sheet--${placement}`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h2
          :id="titleId"
          class="title"
        >
          {{ title }}
        </h2>
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  display: flex;
  justify-content: center;
  background: var(--color-scrim);
}

.backdrop--bottom {
  align-items: flex-end;
}

.backdrop--center {
  align-items: center;
  padding: var(--space-4);
}

/* 浮层压在遮罩之上：底色取 --color-surface 的 88%，比 --glass-thick 更不透明（docs/17 第 3 节：对比度不达标时加厚材质）。 */
.sheet {
  background-color: color-mix(in srgb, var(--color-surface) 88%, transparent);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
}

.sheet--bottom {
  max-width: 393px;
  padding: var(--space-5) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.sheet--center {
  max-width: 480px;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
}

.title {
  font: var(--font-headline);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sheet {
    background-color: color-mix(in srgb, var(--color-surface) 92%, transparent);
  }
}

@media (prefers-reduced-transparency: reduce) {
  .sheet {
    background-color: var(--color-surface);
  }
}

.ui-sheet-enter-active {
  transition: opacity var(--motion-slow) var(--ease-standard);
}

.ui-sheet-enter-active .sheet {
  transition:
    transform var(--motion-slow) var(--ease-standard),
    opacity var(--motion-slow) var(--ease-standard);
}

.ui-sheet-enter-from {
  opacity: 0;
}

.ui-sheet-enter-from .sheet {
  opacity: 0;
  transform: translateY(var(--slide-distance));
}
</style>
