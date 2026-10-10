<script setup lang="ts">
import { computed } from 'vue'

import { api } from '../../api'
import DisplayMetrics from '../../components/display/DisplayMetrics.vue'
import DisplayNotices from '../../components/display/DisplayNotices.vue'
import DisplayTrend from '../../components/display/DisplayTrend.vue'
import DisplayVenueGroup from '../../components/display/DisplayVenueGroup.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useDisplayBoard } from '../../composables/displayPolling'
import { NO_VENUES_DESCRIPTION, NO_VENUES_TITLE, presentBoard } from '../../utils/displayModel'

const state = useDisplayBoard({ fetchSummary: () => api.getDisplaySummary() })
const board = computed(() => presentBoard(state.value))
</script>

<template>
  <!-- data-theme="dark"：运营大屏固定深色，不随系统设置变化（docs/17 第 7 节）。 -->
  <main
    class="display"
    data-theme="dark"
  >
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
    <UiBanner
      v-else-if="board.kind === 'error'"
      class="state error"
      tone="danger"
      role="alert"
    >
      {{ board.message }}
    </UiBanner>

    <template v-else>
      <UiBanner
        v-if="board.staleNotice !== null"
        class="stale"
        tone="warning"
        role="alert"
      >
        {{ board.staleNotice }}
      </UiBanner>
      <DisplayMetrics :metrics="board.view.metrics" />
      <div class="body">
        <div class="venues">
          <UiGlassCard
            v-if="board.view.venues.length === 0"
            tag="section"
            class="no-venues"
            material="thick"
          >
            <UiEmptyState
              :title="NO_VENUES_TITLE"
              :description="NO_VENUES_DESCRIPTION"
            />
          </UiGlassCard>
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
/* 字号随屏幕宽度缩放（em），底线 12px = --font-caption；各处的 em 倍数都不低于 1，所以最小字号不会低于 12px。 */
.display {
  display: flex;
  flex-direction: column;
  gap: 1em;
  min-height: 100vh;
  padding: 1.2em 1.8em;
  background: var(--canvas-glow), var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-family);
  font-size: clamp(12px, 0.85vw, 18px);
  font-variant-numeric: tabular-nums;
}

.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
}

.title {
  font-size: 2.2em;
  font-weight: 700;
}

.updated {
  color: var(--color-text-secondary);
  font-size: 1.1em;
}

.state {
  color: var(--color-text-secondary);
  font-size: 1.6em;
}

.state.error,
.stale.stale {
  font-size: 1.15em;
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 1.2em;
  align-items: start;
}

/* 窄屏（例如 iPhone 竖屏）：两栏改为上下排列，避免数字溢出与标签互相重叠（docs/17 第 9 节）。 */
@media (max-width: 800px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
}

.venues,
.side {
  display: flex;
  flex-direction: column;
  gap: 1em;
  min-width: 0;
}
</style>
