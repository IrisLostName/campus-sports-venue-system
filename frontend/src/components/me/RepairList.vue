<script setup lang="ts">
import type { RepairView } from '../../utils/meDisplay'
import { toneForRepairStatus } from '../../utils/statusTone'
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'

defineProps<{ items: RepairView[]; loaded: boolean; error: string | null }>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <section
    class="repairs"
    aria-label="我的报修"
  >
    <h3>我的报修</h3>
    <UiBanner
      v-if="error !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      <p>报修记录加载失败：{{ error }}</p>
      <UiButton
        variant="plain"
        @click="$emit('retry')"
      >
        重试
      </UiButton>
    </UiBanner>
    <p
      v-else-if="loaded && items.length === 0"
      class="none"
    >
      暂无报修记录
    </p>
    <UiGlassCard
      v-for="item in items"
      :key="item.id"
      tag="article"
      class="item"
      :data-status="item.status"
    >
      <header>
        <span class="venue">{{ item.venueName }}</span>
        <UiStatusPill
          class="badge"
          :tone="toneForRepairStatus(item.status)"
        >
          {{ item.statusLabel }}
        </UiStatusPill>
      </header>
      <p class="description">
        {{ item.description }}
      </p>
      <p
        v-if="item.resultNote !== null"
        class="result"
      >
        处理结果：{{ item.resultNote }}
      </p>
      <p class="time">
        {{ item.createdText }}
      </p>
    </UiGlassCard>
  </section>
</template>

<style scoped>
.repairs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

h3 {
  padding-inline: var(--space-1);
  font: var(--font-headline);
}

.item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.venue {
  font: var(--font-headline);
}

.badge {
  flex: none;
}

.description,
.result {
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
