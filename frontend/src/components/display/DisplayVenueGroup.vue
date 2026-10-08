<script setup lang="ts">
import type { VenueGroupView } from '../../utils/displayModel'
import { toneForResourceState } from '../../utils/statusTone'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'

defineProps<{ venue: VenueGroupView }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="venue"
    material="thick"
  >
    <header class="head">
      <h3 class="name">
        {{ venue.name }}
      </h3>
      <UiStatusPill
        class="tag"
        tone="neutral"
      >
        {{ venue.statusLabel }}
      </UiStatusPill>
      <UiStatusPill
        class="tag"
        tone="neutral"
      >
        {{ venue.bookingLabel }}
      </UiStatusPill>
      <span class="stat">{{ venue.openText }}</span>
      <span class="stat">{{ venue.reservedNowText }}</span>
    </header>
    <ul class="resources">
      <li
        v-for="resource in venue.resources"
        :key="resource.id"
        class="resource"
      >
        <span class="resource-name">{{ resource.name }}</span>
        <UiStatusPill
          class="resource-state"
          :tone="toneForResourceState(resource.state)"
        >
          {{ resource.stateLabel }}
        </UiStatusPill>
      </li>
    </ul>
  </UiGlassCard>
</template>

<style scoped>
.venue {
  padding: 0.8em 1.2em 1em;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5em 1em;
  margin-bottom: 0.7em;
}

.name {
  margin: 0;
  font-size: 1.5em;
  font-weight: 600;
}

.tag.tag {
  font-size: 1em;
}

.stat {
  color: var(--color-text-secondary);
  font-size: 1em;
}

.resources {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr));
  gap: 0.6em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resource {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3em;
  padding: 0.6em 0.8em;
  border: var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-thin);
}

.resource-name {
  font-size: 1.05em;
}

.resource-state.resource-state {
  font-size: 1.1em;
}
</style>
