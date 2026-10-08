<script setup lang="ts">
import { onMounted } from 'vue'

import BookingResult from '../../components/booking/BookingResult.vue'
import ConfirmPanel from '../../components/booking/ConfirmPanel.vue'
import DateStrip from '../../components/booking/DateStrip.vue'
import SlotGrid from '../../components/booking/SlotGrid.vue'
import VenueList from '../../components/booking/VenueList.vue'
import VenueNotices from '../../components/booking/VenueNotices.vue'
import { useBookingBoard } from '../../composables/bookingBoard'

const board = useBookingBoard()
const {
  step, venues, venuesPhase, venuesError, rulesError, venue, dates, date, slotsPhase, slotsError, groups,
  announcementItems, announcementError, confirmation, purpose, submitting, submitError, result,
} = board

onMounted(() => {
  void board.load()
})
</script>

<template>
  <section class="page">
    <h1>订场</h1>

    <template v-if="step === 'venues'">
      <p
        v-if="venuesPhase === 'loading'"
        class="hint"
      >
        加载中…
      </p>
      <div
        v-if="venuesError !== null"
        class="error"
        role="alert"
      >
        <p>{{ venuesError }}</p>
        <button
          type="button"
          @click="board.load()"
        >
          重试
        </button>
      </div>
      <VenueList
        :venues="venues"
        @select="board.selectVenue($event)"
      />
    </template>

    <template v-else-if="step === 'slots' && venue !== null">
      <button
        type="button"
        class="back"
        @click="board.backToVenues()"
      >
        ← 重选场馆
      </button>
      <h2>{{ venue.name }}</h2>
      <VenueNotices
        :items="announcementItems"
        :error="announcementError"
      />
      <p
        v-if="rulesError !== null"
        class="error"
        role="alert"
      >
        无法取得可预约的日期范围：{{ rulesError }}
      </p>
      <DateStrip
        :dates="dates"
        :selected="date"
        @select="board.selectDate($event)"
      />
      <p
        v-if="submitError !== null"
        class="error banner"
        role="alert"
      >
        {{ submitError }}
      </p>
      <p
        v-if="slotsPhase === 'loading'"
        class="hint"
      >
        加载中…
      </p>
      <div
        v-else-if="slotsError !== null"
        class="error"
        role="alert"
      >
        <p>{{ slotsError }}</p>
        <button
          type="button"
          @click="board.loadSlots()"
        >
          重试
        </button>
      </div>
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
.page {
  padding: 16px;
}

h1 {
  margin: 0 0 12px;
  font-size: 22px;
}

h2 {
  margin: 8px 0 12px;
  font-size: 18px;
}

.hint {
  margin: 0 0 12px;
  color: #5f6b7a;
  font-size: 14px;
}

.error {
  margin: 0 0 12px;
  color: #b3261e;
  font-size: 14px;
}

.error p {
  margin: 0 0 8px;
}

.banner {
  margin-top: 12px;
}

.back {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0b6b4f;
  font-size: 15px;
  cursor: pointer;
}
</style>
