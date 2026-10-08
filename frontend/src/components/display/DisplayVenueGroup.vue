<script setup lang="ts">
import type { VenueGroupView } from '../../utils/displayModel'

defineProps<{ venue: VenueGroupView }>()
</script>

<template>
  <section class="venue">
    <header class="head">
      <h3 class="name">
        {{ venue.name }}
      </h3>
      <span class="tag">{{ venue.statusLabel }}</span>
      <span class="tag">{{ venue.bookingLabel }}</span>
      <span class="stat">{{ venue.openText }}</span>
      <span class="stat">{{ venue.reservedNowText }}</span>
    </header>
    <ul class="resources">
      <li
        v-for="resource in venue.resources"
        :key="resource.id"
        class="resource"
        :class="`state-${resource.state.toLowerCase()}`"
      >
        <span class="resource-name">{{ resource.name }}</span>
        <span class="resource-state">{{ resource.stateLabel }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.venue {
  padding: 0.8em 1.2em 1em;
  background: var(--display-panel);
  border: 1px solid var(--display-border);
  border-radius: 0.6em;
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
}

.tag {
  padding: 0.1em 0.7em;
  font-size: 0.95em;
  border: 1px solid var(--display-border);
  border-radius: 1em;
}

.stat {
  font-size: 1em;
  color: var(--display-muted);
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
  gap: 0.15em;
  padding: 0.5em 0.8em;
  border-left: 0.35em solid var(--tile-color);
  background: var(--display-tile);
  border-radius: 0.3em;
}

.resource-name {
  font-size: 1.05em;
}

.resource-state {
  font-size: 1.2em;
  font-weight: 700;
  color: var(--tile-color);
}

.state-free { --tile-color: #3ecf8e; }
.state-reserved { --tile-color: #5aa9ff; }
.state-in_use { --tile-color: #ffb454; }
.state-maintenance { --tile-color: #c0a4ff; }
.state-disabled { --tile-color: #8b95a5; }
</style>
