<script setup lang="ts">
import { computed, onMounted } from 'vue'

import BookingResult from '../../components/booking/BookingResult.vue'
import ConfirmPanel from '../../components/booking/ConfirmPanel.vue'
import DateStrip from '../../components/booking/DateStrip.vue'
import SlotGrid from '../../components/booking/SlotGrid.vue'
import VenueList from '../../components/booking/VenueList.vue'
import VenueNotices from '../../components/booking/VenueNotices.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useBookingBoard } from '../../composables/bookingBoard'
import {
  hasNoSlots, NO_SLOTS_DESCRIPTION, NO_SLOTS_TITLE, NO_VENUES_DESCRIPTION, NO_VENUES_TITLE,
} from '../../utils/bookingDisplay'

const board = useBookingBoard()
const {
  step, venues, venuesPhase, venuesError, rulesError, venue, dates, date, slotsPhase, slotsError, groups,
  announcementItems, announcementError, confirmation, purpose, submitting, submitError, result,
} = board
const noSlots = computed(() => hasNoSlots(groups.value))

onMounted(() => {
  void board.load()
})
</script>

<template>
  <section class="page">
    <h1 class="page-title">
      订场
    </h1>

    <template v-if="step === 'venues'">
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
        @select="board.selectVenue($event)"
      />
    </template>

    <template v-else-if="step === 'slots' && venue !== null">
      <UiButton
        variant="plain"
        class="back"
        @click="board.backToVenues()"
      >
        ← 重选场馆
      </UiButton>
      <h2>{{ venue.name }}</h2>
      <VenueNotices
        :items="announcementItems"
        :error="announcementError"
      />
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
      <DateStrip
        :dates="dates"
        :selected="date"
        @select="board.selectDate($event)"
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
          @click="board.loadSlots()"
        >
          重试
        </UiButton>
      </UiBanner>
      <UiGlassCard
        v-else-if="slotsPhase === 'ready' && noSlots"
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
        @select="(resourceId, startTime) => board.selectSlot(resourceId, startTime)"
      />
    </template>

    <ConfirmPanel
      v-else-if="step === 'confirm' && confirmation !== null"
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
  </section>
</template>

<style scoped>
h2 {
  padding-inline: var(--space-1);
  font: var(--font-title);
}

.back {
  align-self: flex-start;
}
</style>
