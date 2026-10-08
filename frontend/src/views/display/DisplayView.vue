<script setup lang="ts">
import { computed } from 'vue'

import { api } from '../../api'
import DisplayMetrics from '../../components/display/DisplayMetrics.vue'
import DisplayNotices from '../../components/display/DisplayNotices.vue'
import DisplayTrend from '../../components/display/DisplayTrend.vue'
import DisplayVenueGroup from '../../components/display/DisplayVenueGroup.vue'
import { useDisplayBoard } from '../../composables/displayPolling'
import { presentBoard } from '../../utils/displayModel'

const state = useDisplayBoard({ fetchSummary: () => api.getDisplaySummary() })
const board = computed(() => presentBoard(state.value))
</script>

<template>
  <main class="display">
    <header class="top">
      <h1 class="title">
        运营大屏
      </h1>
      <span
        v-if="board.kind === 'ready'"
        class="updated"
      >数据更新于 {{ board.view.generatedAtText }}</span>
    </header>

    <p
      v-if="board.kind === 'loading'"
      class="state"
      role="status"
    >
      正在加载数据…
    </p>
    <p
      v-else-if="board.kind === 'error'"
      class="state error"
      role="alert"
    >
      {{ board.message }}
    </p>

    <template v-else>
      <p
        v-if="board.staleNotice !== null"
        class="stale"
        role="alert"
      >
        {{ board.staleNotice }}
      </p>
      <DisplayMetrics :metrics="board.view.metrics" />
      <div class="body">
        <div class="venues">
          <DisplayVenueGroup
            v-for="venue in board.view.venues"
            :key="venue.id"
            :venue="venue"
          />
        </div>
        <div class="side">
          <DisplayTrend :bars="board.view.trend" />
          <DisplayNotices :notices="board.view.notices" />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.display {
  --display-panel: #172033;
  --display-tile: #1f2b42;
  --display-border: #2c3a55;
  --display-muted: #9fb0c8;

  display: flex;
  flex-direction: column;
  gap: 1em;
  min-height: 100vh;
  padding: 1.2em 1.8em;
  font-size: clamp(12px, 0.85vw, 18px);
  color: #eaf0fa;
  background: #0d1424;
}

.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
}

.title {
  margin: 0;
  font-size: 2.2em;
}

.updated {
  font-size: 1.1em;
  color: var(--display-muted);
}

.state {
  margin: 0;
  font-size: 1.6em;
  color: var(--display-muted);
}

.state.error {
  color: #ff8d8d;
}

.stale {
  margin: 0;
  padding: 0.6em 1em;
  font-size: 1.15em;
  color: #ffd9a0;
  background: #3a2a10;
  border: 1px solid #7a5a22;
  border-radius: 0.4em;
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 1.2em;
  align-items: start;
}

.venues,
.side {
  display: flex;
  flex-direction: column;
  gap: 1em;
  min-width: 0;
}
</style>
