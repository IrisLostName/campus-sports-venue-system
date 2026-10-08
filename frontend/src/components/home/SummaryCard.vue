<script setup lang="ts">
import { PATHS } from '../../router/paths'
import type { ReservationSummary } from '../../utils/reservationDisplay'
import { toneForDisplayStatus } from '../../utils/statusTone'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'

defineProps<{ summary: ReservationSummary; moreCount: number }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="summary"
    aria-label="最近的预约"
  >
    <p class="when">
      {{ summary.dateText }}
      <strong>{{ summary.timeText }}</strong>
    </p>
    <p class="where">
      {{ summary.place }}
    </p>
    <p class="who">
      <span>{{ summary.userDisplayName }}</span>
      <UiStatusPill
        class="badge"
        :tone="toneForDisplayStatus(summary.displayStatus)"
      >
        {{ summary.statusLabel }}
      </UiStatusPill>
    </p>
    <p
      v-if="moreCount > 0"
      class="more"
    >
      <RouterLink :to="PATHS.reservation">
        还有 {{ moreCount }} 个预约
      </RouterLink>
    </p>
    <UiButton
      class="detail"
      variant="secondary"
      :to="PATHS.reservation"
    >
      查看预约详情
    </UiButton>
  </UiGlassCard>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.when {
  color: var(--color-text-secondary);
  font: var(--font-callout);
}

.when strong {
  display: block;
  color: var(--color-text);
  font: var(--font-title);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.where {
  font: var(--font-headline);
}

.who {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--font-callout);
}

.more {
  font: var(--font-callout);
}

.detail {
  margin-top: var(--space-1);
}
</style>
