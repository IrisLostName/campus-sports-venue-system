<script setup lang="ts">
// 列表行（docs/17 第 6 节）：标题、副标题、右侧值或箭头。tag 决定元素（div / article / li / button）；
// 需要自定义内容时用默认插槽替换标题与副标题，用 value 插槽替换右侧值。
withDefaults(defineProps<{
  tag?: 'div' | 'article' | 'li' | 'button'
  title?: string
  subtitle?: string
  value?: string
  arrow?: boolean
}>(), {
  tag: 'div',
  title: undefined,
  subtitle: undefined,
  value: undefined,
  arrow: false,
})
</script>

<template>
  <component
    :is="tag"
    class="ui-list-row"
    :type="tag === 'button' ? 'button' : undefined"
  >
    <span class="main">
      <slot>
        <span class="title">{{ title }}</span>
        <span
          v-if="subtitle !== undefined"
          class="subtitle"
        >{{ subtitle }}</span>
      </slot>
    </span>
    <slot name="value">
      <span
        v-if="value !== undefined"
        class="value"
      >{{ value }}</span>
    </slot>
    <svg
      v-if="arrow"
      class="arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  </component>
</template>

<style scoped>
.ui-list-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-3) var(--space-4);
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: var(--font-body);
  text-align: left;
}

button.ui-list-row {
  cursor: pointer;
}

button.ui-list-row:disabled {
  cursor: not-allowed;
}

.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.title {
  font: var(--font-headline);
}

.subtitle {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.value {
  color: var(--color-text-secondary);
  font: var(--font-callout);
}

.arrow {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--color-text-tertiary);
}
</style>
