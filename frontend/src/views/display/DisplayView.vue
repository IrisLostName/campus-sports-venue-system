<script setup lang="ts">
import { computed } from 'vue'

import { api } from '../../api'
import DisplayLegend from '../../components/display/DisplayLegend.vue'
import UiIcon from '../../components/ui/UiIcon.vue'
import DisplayMetrics from '../../components/display/DisplayMetrics.vue'
import DisplayNotices from '../../components/display/DisplayNotices.vue'
import DisplayStatusDonut from '../../components/display/DisplayStatusDonut.vue'
import DisplayToolbar from '../../components/display/DisplayToolbar.vue'
import DisplayTrend from '../../components/display/DisplayTrend.vue'
import DisplayVenueGroup from '../../components/display/DisplayVenueGroup.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useDisplayBoard, useRefreshCountdown } from '../../composables/displayPolling'
import { NO_VENUES_DESCRIPTION, NO_VENUES_TITLE, presentBoard } from '../../utils/displayModel'
import { useDisplayTheme } from './displayTheme'

const state = useDisplayBoard({ fetchSummary: () => api.getDisplaySummary() })
const board = computed(() => presentBoard(state.value))
const countdown = useRefreshCountdown()
const { theme, toggle: toggleTheme } = useDisplayTheme()
</script>

<template>
  <!-- data-surface="display"：大屏自己的令牌作用域（tokens.css 末尾），默认浅色，可切换深色，不随系统设置变化（UI-2a）。 -->
  <main
    class="display"
    data-surface="display"
    :data-display-theme="theme"
  >
    <header class="top">
      <div class="brand">
        <span class="logo">
          <UiIcon name="dashboard" />
        </span>
        <span class="brand-text">
          <h1 class="title">
            运营大屏
          </h1>
          <span class="subtitle">校园场馆预约与服务管理系统</span>
        </span>
      </div>
      <DisplayToolbar
        :updated-text="board.kind === 'ready' ? board.view.generatedAtText : null"
        :countdown="countdown"
        :theme="theme"
        @toggle-theme="toggleTheme"
      />
    </header>

    <div class="page">
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
        <DisplayMetrics
          :metrics="board.view.metrics"
          :open-resources="board.view.openResources"
        />
        <div class="body">
          <div class="venues">
            <UiGlassCard
              v-if="board.view.venues.length === 0"
              tag="section"
              class="no-venues"
              material="solid"
              radius="sm"
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
            <DisplayLegend v-if="board.view.venues.length > 0" />
          </div>
          <div class="side">
            <DisplayTrend
              :bars="board.view.trend"
              :ticks="board.view.trendTicks"
            />
            <DisplayStatusDonut
              :breakdown="board.view.stateBreakdown"
              :total="board.view.resourceCount"
            />
            <DisplayNotices :notices="board.view.notices" />
          </div>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* 字号随屏幕宽度缩放（em），底线 12px = --font-caption；各处的 em 倍数都不低于 1，所以最小字号不会低于 12px。
   1366×768、1440×900、1920×1080 下一屏显示完整（UI-2a-rulings 第 1 节）。 */
.display {
  display: flex;
  flex-direction: column;
  gap: 1em;
  min-height: 100vh;
  background: var(--canvas-glow), var(--color-canvas);
  color: var(--color-text);
  font-family: var(--font-family);
  font-size: clamp(12px, 0.85vw, 18px);
  font-variant-numeric: tabular-nums;
  transition: background-color var(--display-motion), color var(--display-motion);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 0.6em 1.6em;
  border-bottom: 1px solid var(--color-separator);
  background: var(--color-surface);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.8em;
}

.logo {
  display: grid;
  place-items: center;
  width: 2.2em;
  height: 2.2em;
  border-radius: var(--radius-sm);
  background: var(--color-accent-fill);
  color: var(--on-accent);
  font-size: 1.3em;
}

.logo :deep(.ui-icon) {
  width: 1.3em;
  height: 1.3em;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.title {
  margin: 0;
  font-size: 1.5em;
  font-weight: 600;
  line-height: 1.3;
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 1em;
}

.page {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1em;
  padding: 0 1.6em 1.2em;
}

.state {
  color: var(--color-text-secondary);
  font-size: 1.6em;
}

.state.error,
.stale.stale {
  font-size: 1.15em;
}

/* 主体撑满顶栏与概览之后剩下的高度（FE-8 L13）：两栏等高，面板随之拉伸。 */
.body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1em;
  align-items: stretch;
}

/* 窄屏（例如 iPhone 竖屏）：两栏改为上下排列，允许纵向滚动（docs/17 第 9 节）。 */
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

.no-venues {
  flex: 1;
}
</style>
