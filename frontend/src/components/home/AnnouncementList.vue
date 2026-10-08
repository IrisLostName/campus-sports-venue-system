<script setup lang="ts">
import type { AnnouncementItem } from '../../utils/reservationDisplay'
import UiBanner from '../ui/UiBanner.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiListRow from '../ui/UiListRow.vue'

defineProps<{ items: AnnouncementItem[]; loaded: boolean; error: string | null }>()
</script>

<template>
  <section
    class="announcements"
    aria-label="系统公告"
  >
    <h2>系统公告</h2>
    <UiBanner
      v-if="error !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      公告加载失败：{{ error }}
    </UiBanner>
    <p
      v-else-if="loaded && items.length === 0"
      class="none"
    >
      暂无公告
    </p>
    <UiGlassCard
      v-if="items.length > 0"
      :padding="0"
    >
      <UiListRow
        v-for="item in items"
        :key="item.id"
        tag="article"
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
      </UiListRow>
    </UiGlassCard>
  </section>
</template>

<style scoped>
.announcements {
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
  font: var(--font-headline);
}

.content {
  font: var(--font-callout);
  overflow-wrap: anywhere;
}

.time {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.none {
  color: var(--color-text-secondary);
  font: var(--font-callout);
}
</style>
