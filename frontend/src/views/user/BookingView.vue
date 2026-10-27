<script setup lang="ts">
// “订场”页（FE-4；UI-3 改为三层叠放）：场馆 → 日期（弹出月历）→ 时段，后一层压在前一层上，可逐层返回。
// 步骤由 bookingBoard 的数据决定；确认与成功两步沿用原来的页面步骤，整体替换三层（UI-3 裁决第 1 节）。
import { computed, onMounted } from 'vue'

import BookingLayer from '../../components/booking/BookingLayer.vue'
import BookingResult from '../../components/booking/BookingResult.vue'
import ConfirmPanel from '../../components/booking/ConfirmPanel.vue'
import MonthCalendar from '../../components/booking/MonthCalendar.vue'
import SlotsLayer from '../../components/booking/SlotsLayer.vue'
import VenueList from '../../components/booking/VenueList.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useBookingBoard } from '../../composables/bookingBoard'
import { calendarDays } from '../../utils/bookingCalendar'
import { NO_VENUES_DESCRIPTION, NO_VENUES_TITLE } from '../../utils/bookingDisplay'
import { formatServiceDate } from '../../utils/reservationDisplay'

const board = useBookingBoard()
const {
  step, venues, venuesPhase, venuesError, rulesError, venue, dates, date, slotsPhase, slotsError, groups, pinned,
  announcementItems, announcementError, confirmation, purpose, submitting, submitError, result,
} = board

const browsing = computed(() => step.value === 'venues' || step.value === 'dates' || step.value === 'slots')
const LAYER_DEPTH = { venues: 0, dates: 1, slots: 2 } as const
const baseDepth = computed(() => (step.value === 'dates' || step.value === 'slots' ? LAYER_DEPTH[step.value] : 0))

// 31 格月历：第一天是今天（dates 的第一项），可选天数 = dates 的个数 = advanceDays（规则没取到时没有日期）。
const days = computed(() => {
  const first = dates.value[0]
  return first === undefined ? [] : calendarDays(first.value, dates.value.length)
})
const dateText = computed(() => (date.value === null ? '' : formatServiceDate(date.value)))

onMounted(() => {
  void board.load()
})
</script>

<template>
  <section class="page">
    <template v-if="browsing">
      <BookingLayer
        base
        :depth="baseDepth"
      >
        <h1 class="page-title">
          订场
        </h1>
        <p
          v-if="venuesPhase === 'loading'"
          class="hint"
        >
          加载中…
        </p>
        <UiBanner
          v-if="venuesError !== null"
          class="error"
          tone="danger"
          role="alert"
        >
          <p>{{ venuesError }}</p>
          <UiButton
            variant="plain"
            @click="board.load()"
          >
            重试
          </UiButton>
        </UiBanner>
        <UiGlassCard
          v-if="venuesPhase === 'ready' && venues.length === 0"
          tag="section"
        >
          <UiEmptyState
            :title="NO_VENUES_TITLE"
            :description="NO_VENUES_DESCRIPTION"
          />
        </UiGlassCard>
        <VenueList
          :venues="venues"
          :pinned="pinned"
          @select="board.selectVenue($event)"
        />
      </BookingLayer>

      <BookingLayer
        :open="(step === 'dates' || step === 'slots') && venue !== null"
        :depth="step === 'slots' ? 1 : 0"
        label="选择日期"
        @close="board.backToVenues()"
      >
        <header class="layer-head">
          <div>
            <h2>选择日期</h2>
            <p class="layer-sub">
              {{ venue?.name }}
            </p>
          </div>
          <UiButton
            variant="plain"
            @click="board.backToVenues()"
          >
            重选场馆
          </UiButton>
        </header>
        <UiBanner
          v-if="rulesError !== null"
          class="error"
          tone="danger"
          role="alert"
        >
          <p>无法取得可预约的日期范围：{{ rulesError }}</p>
          <UiButton
            variant="plain"
            @click="board.retryRules()"
          >
            重试
          </UiButton>
        </UiBanner>
        <MonthCalendar
          v-if="days.length > 0"
          :days="days"
          :selected="date"
          :advance-days="dates.length"
          @select="board.selectDate($event)"
        />
      </BookingLayer>

      <BookingLayer
        :open="step === 'slots' && venue !== null"
        :depth="0"
        size="tall"
        :label="`${venue?.name ?? ''} ${dateText} 时段`"
        @close="board.backToDates()"
      >
        <SlotsLayer
          :venue-name="venue?.name ?? ''"
          :date-text="dateText"
          :announcement-items="announcementItems"
          :announcement-error="announcementError"
          :submit-error="submitError"
          :slots-phase="slotsPhase"
          :slots-error="slotsError"
          :groups="groups"
          @back="board.backToDates()"
          @retry="board.loadSlots()"
          @select="(resourceId, startTime) => board.selectSlot(resourceId, startTime)"
        />
      </BookingLayer>
    </template>

    <template v-else>
      <h1 class="page-title">
        订场
      </h1>
      <ConfirmPanel
        v-if="step === 'confirm' && confirmation !== null"
        v-model:purpose="purpose"
        :confirmation="confirmation"
        :submitting="submitting"
        :error="submitError"
        @submit="board.submit()"
        @back="board.backToSlots()"
      />

      <BookingResult
        v-else-if="step === 'done' && result !== null"
        :result="result"
        @again="board.restart()"
      />
    </template>
  </section>
</template>

<style scoped>
.layer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

h2 {
  font: var(--font-title);
}

.layer-sub {
  color: var(--color-text-secondary);
  font: var(--font-callout);
}
</style>
