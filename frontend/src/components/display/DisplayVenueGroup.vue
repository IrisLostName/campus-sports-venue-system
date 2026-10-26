<script setup lang="ts">
// 场馆卡片（UI-2a-rulings 第 1 节）：标题与两个标签、开放场地与当前已预约、已预约进度条、场地方块（每行最多 6 个）。
// 状态色只用于圆点、色条与浅色底，文字一律用正文色（docs/17 第 2 节）；场地状态的色调取 toneForResourceState（第 6 节）。
import type { VenueGroupView } from '../../utils/displayModel'
import { toneForResourceState } from '../../utils/statusTone'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'

defineProps<{ venue: VenueGroupView }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="venue display-panel"
    material="solid"
    radius="sm"
  >
    <header class="head">
      <h3 class="name display-panel-title display-panel-title--inline">
        <UiIcon
          class="panel-title-icon"
          name="building"
        />
        {{ venue.name }}
      </h3>
      <span class="tags">
        <span
          class="tag"
          :class="venue.isOpen ? 'tone-success' : 'tone-danger'"
        >{{ venue.statusLabel }}</span>
        <span
          class="tag"
          :class="venue.bookingEnabled ? 'tone-accent' : 'tone-neutral'"
        >{{ venue.bookingLabel }}</span>
      </span>
    </header>
    <div class="meta">
      <span class="stat">{{ venue.openText }}</span>
      <span class="stat">{{ venue.reservedNowText }}</span>
      <span
        class="progress"
        role="progressbar"
        aria-label="当前已预约占开放场地的比例"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(venue.reservedRatio * 100)"
      >
        <span
          class="progress-fill"
          :style="{ width: `${venue.reservedRatio * 100}%` }"
        />
      </span>
    </div>
    <ul class="resources">
      <li
        v-for="resource in venue.resources"
        :key="resource.id"
        class="resource"
        :class="`tone-${toneForResourceState(resource.state)}`"
      >
        <span class="resource-name">{{ resource.name }}</span>
        <span class="resource-state">
          <span
            class="dot"
            aria-hidden="true"
          />{{ resource.stateLabel }}</span>
      </li>
    </ul>
  </UiGlassCard>
</template>

<style scoped>
/* 面板在列里平分多出来的高度（FE-8 L13）；场地方块按内容高度排列，不随面板拉伸。 */
.venue { display: flex; flex: 1 1 auto; flex-direction: column; }

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em 1em;
  margin-bottom: 0.5em;
}

.tags {
  display: flex;
  gap: 0.5em;
}

.tag {
  padding: 0.1em 0.6em;
  border: 1px solid var(--tone);
  border-radius: var(--radius-sm);
  background: var(--tone-soft);
  color: var(--color-text);
  font-size: 1em;
  line-height: 1.5;
}

.meta {
  display: flex;
  align-items: center;
  gap: 1.6em;
  margin-bottom: 0.7em;
  color: var(--color-text-secondary);
  font-size: 1.05em;
}

.progress {
  flex: 1;
  max-width: 20em;
  height: 0.5em;
  overflow: hidden;
  border-radius: var(--radius-capsule);
  background: var(--display-track);
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent-fill);
  transition: width var(--display-motion);
}

.resources {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  align-content: start;
  gap: 0.7em;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 800px) {
  .resources {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.resource {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  min-width: 0;
  padding: 0.6em 0.7em 0.6em 1em;
  overflow: hidden;
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.resource::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--tone);
  content: "";
}

.resource-name {
  overflow: hidden;
  font-size: 1.1em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  color: var(--color-text-secondary);
  font-size: 1.05em;
}

.dot {
  flex: none;
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: var(--tone);
}
</style>
