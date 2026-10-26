<script setup lang="ts">
// 按钮（docs/17 第 6 节）。传 to 时渲染为路由链接（外观相同），否则是 <button>。
// loading 只加转圈图标并禁用，不改变按钮文字；disabled 为 false 时不渲染 disabled 属性。
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'plain'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  block?: boolean
  type?: 'button' | 'submit'
  to?: RouteLocationRaw
}>(), {
  variant: 'primary',
  disabled: false,
  loading: false,
  block: false,
  type: 'button',
  to: undefined,
})

const classes = computed(() => [
  `ui-button--${props.variant}`,
  { 'ui-button--block': props.block },
  props.variant === 'secondary' ? ['ui-glass', 'ui-glass--thin'] : [],
])
</script>

<template>
  <RouterLink
    v-if="to !== undefined"
    :to="to"
    class="ui-button"
    :class="classes"
  >
    <slot />
  </RouterLink>
  <button
    v-else
    class="ui-button"
    :class="classes"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
  >
    <svg
      v-if="loading"
      class="spinner"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-capsule);
  font: var(--font-callout);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform var(--motion-fast) var(--ease-standard),
    opacity var(--motion-fast) var(--ease-standard);
}

.ui-button:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.ui-button--block {
  display: flex;
  width: 100%;
}

.ui-button--primary {
  background: var(--color-accent-fill);
  color: var(--on-accent);
}

/* 玻璃按钮：边缘与模糊来自 .ui-glass，底色取 --color-surface 的 60%，保证强调色文字在厚玻璃卡片上仍有 4.5:1。 */
.ui-button--secondary {
  background-color: color-mix(in srgb, var(--color-surface) 60%, transparent);
  color: var(--color-accent);
}

.ui-button--destructive {
  /* 文字是 --color-danger-text：底色只用半档浅色，保证文字对比度 ≥ 4.5:1。 */
  background: color-mix(in srgb, var(--color-danger) calc(var(--tint-strength) / 2), transparent);
  color: var(--color-danger-text);
}

.ui-button--plain {
  padding: 0 var(--space-2);
  background: transparent;
  color: var(--color-accent);
}

.ui-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  animation: ui-button-spin 900ms linear infinite;
}

@keyframes ui-button-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 减少透明度：玻璃按钮改为实色。 */
@media (prefers-reduced-transparency: reduce) {
  .ui-button--secondary {
    background-color: var(--color-surface);
  }
}

/* 减少动态效果：转圈改为静止的图标，按钮文字与 aria-busy 仍表明在处理中。 */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
