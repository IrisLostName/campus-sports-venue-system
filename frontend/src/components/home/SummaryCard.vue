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
    <div class="actions">
      <UiButton
        class="detail"
        variant="secondary"
        :to="PATHS.reservation"
      >
        查看预约详情
      </UiButton>
      <UiButton
        class="book"
        :to="PATHS.booking"
      >
        去订场
      </UiButton>
    </div>
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

/* 触控目标不小于 44px（docs/17 第 4 节）。 */
.more a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

/* UI-4：“查看预约详情”与“去订场”并排，间距 12px，窄屏时换行。 */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-1);
}
</style>
