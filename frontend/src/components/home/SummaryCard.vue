<script setup lang="ts">
import { PATHS } from '../../router/paths'
import type { ReservationSummary } from '../../utils/reservationDisplay'

defineProps<{ summary: ReservationSummary; moreCount: number }>()
</script>

<template>
  <section
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
      <span class="badge">{{ summary.statusLabel }}</span>
    </p>
    <p
      v-if="moreCount > 0"
      class="more"
    >
      <RouterLink :to="PATHS.reservation">
        还有 {{ moreCount }} 个预约
      </RouterLink>
    </p>
    <RouterLink
      class="detail"
      :to="PATHS.reservation"
    >
      查看预约详情
    </RouterLink>
  </section>
</template>

<style scoped>
.summary {
  padding: 16px;
  border-radius: 12px;
  background: #0b6b4f;
  color: #ffffff;
}

p {
  margin: 0;
}

.when {
  font-size: 15px;
}

.when strong {
  display: block;
  margin-top: 2px;
  font-size: 28px;
  line-height: 1.2;
}

.where {
  margin-top: 8px;
  font-size: 17px;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 15px;
}

.badge {
  padding: 0 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 20%);
  font-size: 13px;
  line-height: 1.6;
}

.more {
  margin-top: 10px;
  font-size: 14px;
}

a {
  color: #ffffff;
}

.detail {
  display: inline-block;
  margin-top: 12px;
  padding: 10px 0;
  font-size: 15px;
}
</style>
