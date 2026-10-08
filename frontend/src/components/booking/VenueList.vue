<script setup lang="ts">
import type { VenueSummary } from '../../api/types'
import { NOT_BOOKABLE_TEXT } from '../../utils/bookingDisplay'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiListRow from '../ui/UiListRow.vue'

defineProps<{ venues: VenueSummary[] }>()

defineEmits<{ select: [venueId: number] }>()
</script>

<template>
  <UiGlassCard
    v-if="venues.length > 0"
    tag="ul"
    class="venues"
    :padding="0"
  >
    <li
      v-for="venue in venues"
      :key="venue.id"
    >
      <UiListRow
        tag="button"
        class="venue"
        :class="{ closed: !venue.bookable }"
        :arrow="venue.bookable"
        :disabled="!venue.bookable"
        @click="$emit('select', venue.id)"
      >
        <span class="name">{{ venue.name }}</span>
        <span
          v-if="venue.bookable"
          class="meta"
        >
          {{ venue.resourceCount }} 个场地<template v-if="venue.location !== null"> · {{ venue.location }}</template>
        </span>
        <span
          v-else
          class="meta not-bookable"
        >
          {{ NOT_BOOKABLE_TEXT }}
        </span>
      </UiListRow>
    </li>
  </UiGlassCard>
</template>

<style scoped>
.venues {
  margin: 0;
  list-style: none;
  overflow: hidden;
}

li + li {
  border-top: 1px solid var(--color-separator);
}

.name {
  font: var(--font-headline);
}

.meta {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.venue.closed {
  opacity: 0.6;
}
</style>
