<script setup lang="ts">
// 本周预约趋势（UI-2a-rulings 第 1 节、第 6 节第 2 条）：平滑面积折线，横轴日期、纵轴数量，每个点的数值始终显示在点的上方。
// SVG 只画线与面积（拉伸到绘图区）；日期、数值与刻度都是 HTML 文字，字号不随拉伸变化。
// 每列一个 li.bar：.fill 是从横轴到该点的竖向参考线，高度即该点相对最大值的比例。
import { computed } from 'vue'

import type { TrendBarView, TrendTickView } from '../../utils/displayModel'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'
import { areaPath, smoothLinePath } from './chartGeometry'

const props = defineProps<{ bars: TrendBarView[]; ticks: TrendTickView[] }>()

const line = computed(() => smoothLinePath(props.bars))
const area = computed(() => areaPath(props.bars))
const summary = computed(() => `本周预约趋势：${props.bars.map((bar) => `${bar.label} ${bar.count} 单`).join('，')}`)
</script>

<template>
  <UiGlassCard
    tag="section"
    class="trend display-panel"
    material="solid"
    radius="sm"
  >
    <header class="panel-head">
      <h3 class="title display-panel-title display-panel-title--inline">
        <UiIcon
          class="panel-title-icon"
          name="trend"
        />
        本周预约趋势
      </h3>
      <span class="note">近 7 天（含今天）</span>
    </header>
    <div class="chart">
      <ul
        class="ticks"
        aria-hidden="true"
      >
        <li
          v-for="tick in ticks"
          :key="tick.value"
          class="tick"
          :style="{ bottom: `${tick.percent}%` }"
        >
          {{ tick.value }}
        </li>
      </ul>
      <div class="plot">
        <svg
          class="lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          :aria-label="summary"
        >
          <defs>
            <linearGradient
              id="display-trend-area"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0"
                class="area-top"
              />
              <stop
                offset="1"
                class="area-bottom"
              />
            </linearGradient>
          </defs>
          <line
            v-for="tick in ticks"
            :key="tick.value"
            class="grid"
            x1="0"
            x2="100"
            :y1="100 - tick.percent"
            :y2="100 - tick.percent"
          />
          <path
            class="area"
            :d="area"
          />
          <path
            class="line"
            :d="line"
          />
        </svg>
        <ul class="bars">
          <li
            v-for="bar in bars"
            :key="bar.date"
            class="bar"
          >
            <span class="track">
              <span class="lane">
                <span
                  class="fill"
                  :style="{ height: `${bar.heightPercent}%` }"
                />
                <span
                  class="point"
                  :style="{ bottom: `${bar.heightPercent}%` }"
                />
                <span
                  class="count"
                  :style="{ bottom: `${bar.heightPercent}%` }"
                >{{ bar.count }}</span>
              </span>
            </span>
            <span class="date">{{ bar.label }}</span>
          </li>
        </ul>
      </div>
    </div>
  </UiGlassCard>
</template>

<style scoped>
/* 趋势面板吃掉右栏多出来的高度，图随之变高（FE-8 L13）；绘图区最低 12em。 */
.trend {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
  margin-bottom: 0.4em;
}

.note {
  color: var(--color-text-secondary);
  font-size: 1em;
}

/* --label-room：最高点上方留给数值的高度；--axis-room：横轴日期一行的高度。SVG 与各列的绘图区上下边界相同。 */
.chart {
  display: flex;
  flex: 1;
  min-height: 12em;
  --label-room: 1.8em;
  --axis-room: 1.8em;
}

.ticks {
  position: relative;
  flex: none;
  width: 2.4em;
  margin: var(--label-room) 0 var(--axis-room);
  padding: 0;
  list-style: none;
}

.tick {
  position: absolute;
  right: 0.6em;
  color: var(--color-text-secondary);
  font-size: 1em;
  line-height: 1;
  transform: translateY(50%);
}

.plot {
  position: relative;
  flex: 1;
  min-width: 0;
}

.lines {
  position: absolute;
  top: var(--label-room);
  right: 0;
  bottom: var(--axis-room);
  left: 0;
  width: 100%;
  height: calc(100% - var(--label-room) - var(--axis-room));
  overflow: visible;
}

.grid {
  stroke: var(--color-separator);
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}

.area-top { stop-color: var(--display-area-top); }
.area-bottom { stop-color: var(--display-area-bottom); }

.area {
  fill: url("#display-trend-area");
}

.line {
  fill: none;
  stroke: var(--color-accent-fill);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.bars {
  position: absolute;
  inset: 0;
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bar {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.track {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding-top: var(--label-room);
}

.lane {
  position: relative;
  flex: 1;
}

.fill {
  position: absolute;
  bottom: 0;
  left: 50%;
  border-left: 1px dashed var(--color-separator);
}

.point {
  position: absolute;
  left: 50%;
  width: 0.7em;
  height: 0.7em;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent-fill);
  transform: translate(-50%, 50%);
}

.count {
  position: absolute;
  left: 50%;
  margin-bottom: 0.6em;
  font-size: 1.1em;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  transform: translateX(-50%);
}

.date {
  height: var(--axis-room);
  color: var(--color-text-secondary);
  font-size: 1em;
  line-height: var(--axis-room);
  text-align: center;
  white-space: nowrap;
}
</style>
