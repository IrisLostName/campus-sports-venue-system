<script setup lang="ts">
// 订场第三层的内容（UI-3 裁决第 1 节第三层）：场馆名与所选日期、“更改日期”（返回月历层）、场馆公告、
// 提交失败的提示、时段的加载中 / 失败 / 空状态，以及沿用的时段组件 SlotGrid（状态、文案与可选规则不变）。
import type { ListPhase } from '../../composables/reservationList'
import { hasNoSlots, NO_SLOTS_DESCRIPTION, NO_SLOTS_TITLE, type SlotGroup } from '../../utils/bookingDisplay'
import type { AnnouncementItem } from '../../utils/reservationDisplay'
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'
import SlotGrid from './SlotGrid.vue'
import VenueNotices from './VenueNotices.vue'

defineProps<{
  venueName: string
  dateText: string
  announcementItems: AnnouncementItem[]
  announcementError: string | null
  submitError: string | null
  slotsPhase: ListPhase
  slotsError: string | null
  groups: SlotGroup[]
}>()

defineEmits<{ back: []; retry: []; select: [resourceId: number, startTime: string] }>()
</script>

<template>
  <header class="head">
    <div class="titles">
      <h2
        class="title"
        tabindex="-1"
        data-autofocus
      >
        {{ venueName }}
      </h2>
      <p class="date">
        <UiIcon
          name="calendar"
          class="date-icon"
        />
        {{ dateText }}
      </p>
    </div>
    <UiButton
      variant="plain"
      class="change-date"
      @click="$emit('back')"
    >
      更改日期
    </UiButton>
  </header>
  <VenueNotices
    :items="announcementItems"
    :error="announcementError"
  />
  <UiBanner
    v-if="submitError !== null"
    class="error banner"
    tone="danger"
    role="alert"
  >
    {{ submitError }}
  </UiBanner>
  <p
    v-if="slotsPhase === 'loading'"
    class="hint"
  >
    加载中…
  </p>
  <UiBanner
    v-else-if="slotsError !== null"
    class="error"
    tone="danger"
    role="alert"
  >
    <p>{{ slotsError }}</p>
    <UiButton
      variant="plain"
      @click="$emit('retry')"
    >
      重试
    </UiButton>
  </UiBanner>
  <UiGlassCard
    v-else-if="slotsPhase === 'ready' && hasNoSlots(groups)"
    tag="section"
  >
    <UiEmptyState
      :title="NO_SLOTS_TITLE"
      :description="NO_SLOTS_DESCRIPTION"
    />
  </UiGlassCard>
  <SlotGrid
    v-else
    :groups="groups"
    @select="(resourceId, startTime) => $emit('select', resourceId, startTime)"
  />
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.titles {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.title {
  font: var(--font-title);
}

.title:focus {
  outline: none;
}

.title:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-secondary);
  font: var(--font-callout);
}

.date-icon {
  width: 16px;
  height: 16px;
}

.change-date {
  flex: none;
}
</style>
