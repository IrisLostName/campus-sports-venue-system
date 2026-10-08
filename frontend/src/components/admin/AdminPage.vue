<script setup lang="ts">
// 管理端页面骨架（FE-5）：标题、右侧操作区、错误提示（role=alert）与成功提示（role=status），其余由默认插槽提供。
import UiBanner from '../ui/UiBanner.vue'

defineProps<{ title: string; error?: string | null; notice?: string | null }>()
</script>

<template>
  <section class="admin-page">
    <header class="head">
      <h1 class="title">
        {{ title }}
      </h1>
      <div class="actions">
        <slot name="actions" />
      </div>
    </header>
    <UiBanner
      v-if="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>
    <UiBanner
      v-if="notice"
      tone="success"
      role="status"
    >
      {{ notice }}
    </UiBanner>
    <slot />
  </section>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.title {
  font: var(--font-title);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
