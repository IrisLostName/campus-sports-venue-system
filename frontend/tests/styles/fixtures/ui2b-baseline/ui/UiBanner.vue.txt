<script setup lang="ts">
// 页面级提示（docs/17 第 6 节）：错误、成功、过期数据。role 由使用处写（alert / status），随属性落到根元素。
// tone 只决定图标与浅色底；文字一律是 --color-text。
import type { Tone } from '../../utils/statusTone'

withDefaults(defineProps<{
  tone?: Tone
  tag?: string
}>(), {
  tone: 'accent',
  tag: 'div',
})
</script>

<template>
  <component
    :is="tag"
    class="ui-banner"
    :class="`ui-banner--${tone}`"
  >
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
    <div class="body">
      <slot />
    </div>
  </component>
</template>

<style scoped>
.ui-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--banner-tone) 35%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--banner-tone) var(--tint-strength), transparent);
  color: var(--color-text);
  font: var(--font-callout);
}

.icon {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: var(--banner-tone);
}

.body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.ui-banner--accent { --banner-tone: var(--color-accent); }
.ui-banner--success { --banner-tone: var(--color-success); }
.ui-banner--warning { --banner-tone: var(--color-warning); }
.ui-banner--danger { --banner-tone: var(--color-danger); }
.ui-banner--neutral { --banner-tone: var(--color-neutral); }
</style>
