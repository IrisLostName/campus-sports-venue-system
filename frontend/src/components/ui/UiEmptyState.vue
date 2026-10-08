<script setup lang="ts">
// 空状态（docs/17 第 6 节）：标题、说明、可选操作。标题是第一个 <p>，说明是第二个；action 插槽有内容才渲染。
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="ui-empty-state">
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="3"
      />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
    <p class="title">
      {{ title }}
    </p>
    <p
      v-if="description !== undefined"
      class="description"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.action"
      class="action"
    >
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.ui-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.icon {
  width: 44px;
  height: 44px;
  color: var(--color-text-tertiary);
}

.title {
  font: var(--font-headline);
}

.description {
  max-width: 30ch;
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.action {
  margin-top: var(--space-2);
}
</style>
