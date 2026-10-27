<script setup lang="ts">
// 订场第一层（UI-3）：每个场馆一张宽卡片；pinned 是各场馆置顶的一条场馆公告（没有则不显示）。
import type { VenueSummary } from '../../api/types'
import type { AnnouncementItem } from '../../utils/reservationDisplay'
import VenueCard from './VenueCard.vue'

defineProps<{ venues: VenueSummary[]; pinned: Record<number, AnnouncementItem> }>()

defineEmits<{ select: [venueId: number] }>()
</script>

<template>
  <ul
    v-if="venues.length > 0"
    class="venues"
    aria-label="场馆"
  >
    <VenueCard
      v-for="venue in venues"
      :key="venue.id"
      :venue="venue"
      :pinned="pinned[venue.id] ?? null"
      @select="$emit('select', $event)"
    />
  </ul>
</template>

<style scoped>
.venues {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
