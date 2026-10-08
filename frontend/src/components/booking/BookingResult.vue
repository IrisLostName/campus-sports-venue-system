<script setup lang="ts">
import { PATHS } from '../../router/paths'
import type { ReservationSummary } from '../../utils/reservationDisplay'
import { toneForDisplayStatus } from '../../utils/statusTone'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'

defineProps<{ result: ReservationSummary }>()

defineEmits<{ again: [] }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="result"
    aria-label="预约结果"
    material="thick"
    radius="2xl"
    :padding="5"
  >
    <h2>预约成功</h2>
    <dl class="rows">
      <div>
        <dt>地点</dt>
        <dd>{{ result.place }}</dd>
      </div>
      <div>
        <dt>日期</dt>
        <dd>{{ result.dateText }}</dd>
      </div>
      <div>
        <dt>时间</dt>
        <dd>{{ result.timeText }}</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>
          <UiStatusPill :tone="toneForDisplayStatus(result.displayStatus)">
            {{ result.statusLabel }}
          </UiStatusPill>
        </dd>
      </div>
    </dl>
    <div class="links">
      <UiButton
        class="link"
        :to="PATHS.reservation"
      >
        查看预约
      </UiButton>
      <UiButton
        class="link"
        variant="secondary"
        :to="PATHS.home"
      >
        回到首页
      </UiButton>
    </div>
    <UiButton
      variant="plain"
      block
      @click="$emit('again')"
    >
      继续订场
    </UiButton>
  </UiGlassCard>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

h2 {
  font: var(--font-title);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.rows div {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font: var(--font-callout);
}

dt {
  flex: none;
  width: 3em;
  color: var(--color-text-secondary);
}

dd {
  min-width: 0;
  overflow-wrap: anywhere;
}

.links {
  display: flex;
  gap: var(--space-2);
}

.link {
  flex: 1;
}
</style>
