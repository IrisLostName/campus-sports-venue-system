<script setup lang="ts">
import type { VenueSummary } from '../../api/types'
import { NOT_BOOKABLE_TEXT } from '../../utils/bookingDisplay'

defineProps<{ venues: VenueSummary[] }>()

defineEmits<{ select: [venueId: number] }>()
</script>

<template>
  <ul class="venues">
    <li
      v-for="venue in venues"
      :key="venue.id"
    >
      <button
        type="button"
        class="venue"
        :class="{ closed: !venue.bookable }"
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
      </button>
    </li>
  </ul>
</template>

<style scoped>
.venues {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  margin-bottom: 8px;
}

.venue {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  min-height: 56px;
  padding: 12px 16px;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  background: #ffffff;
  color: #1f2933;
  text-align: left;
  cursor: pointer;
}

.name {
  font-size: 17px;
  font-weight: 600;
}

.meta {
  color: #5f6b7a;
  font-size: 14px;
}

.venue.closed {
  border-style: dashed;
  background: #f1f4f8;
  color: #8a94a1;
  cursor: not-allowed;
}

.not-bookable {
  color: #8a94a1;
}
</style>
