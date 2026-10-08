<script setup lang="ts">
import type { AnnouncementItem } from '../../utils/reservationDisplay'
import UiBanner from '../ui/UiBanner.vue'

defineProps<{ items: AnnouncementItem[]; error: string | null }>()
</script>

<template>
  <section
    v-if="items.length > 0 || error !== null"
    class="notices"
    aria-label="场馆公告"
  >
    <h2>场馆公告</h2>
    <UiBanner
      v-if="error !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      公告加载失败：{{ error }}
    </UiBanner>
    <UiBanner
      v-for="item in items"
      :key="item.id"
      tag="article"
      tone="warning"
    >
      <h3>{{ item.title }}</h3>
      <p
        v-if="item.content !== null"
        class="content"
      >
        {{ item.content }}
      </p>
      <p class="time">
        {{ item.publishedText }}
      </p>
    </UiBanner>
  </section>
</template>

<style scoped>
.notices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

h2 {
  padding-inline: var(--space-1);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  font-weight: 600;
}

h3 {
  font: var(--font-callout);
  font-weight: 600;
}

.content {
  font: var(--font-callout);
  overflow-wrap: anywhere;
}

.time {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}
</style>
