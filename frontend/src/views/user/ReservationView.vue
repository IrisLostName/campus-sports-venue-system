<script setup lang="ts">
import { onMounted } from 'vue'

import CancelDialog from '../../components/reservation/CancelDialog.vue'
import ReservationCardView from '../../components/reservation/ReservationCard.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useReservationBoard } from '../../composables/reservationBoard'
import { PATHS } from '../../router/paths'

const {
  phase, cards, isBusy, isEmpty, busyId, loadError, rulesError, pageFeedback, cancelTarget, cancelReason,
  feedbackFor, trigger, confirmCancel, dismissCancel, load, cancelLockedIds, cancelLockedNote,
} = useReservationBoard()

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <h1 class="page-title">
      预约
    </h1>

    <p
      v-if="phase === 'loading'"
      class="hint"
    >
      加载中…
    </p>

    <UiBanner
      v-if="loadError !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      <p>{{ loadError }}</p>
      <UiButton
        variant="plain"
        @click="load()"
      >
        重试
      </UiButton>
    </UiBanner>

    <UiBanner
      v-if="pageFeedback !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      {{ pageFeedback }}
    </UiBanner>
    <p
      v-if="rulesError !== null"
      class="hint"
    >
      签到与取消说明暂时无法显示：{{ rulesError }}
    </p>

    <UiGlassCard
      v-if="isEmpty"
      class="empty"
    >
      <UiEmptyState title="暂无当前预约">
        <template #action>
          <UiButton :to="PATHS.booking">
            去订场
          </UiButton>
        </template>
      </UiEmptyState>
    </UiGlassCard>

    <ReservationCardView
      v-for="card in cards"
      :key="card.id"
      :card="card"
      :busy="isBusy"
      :working="busyId === card.id"
      :feedback="feedbackFor(card.id)"
      :cancel-locked="cancelLockedIds.has(card.id)"
      :cancel-locked-note="cancelLockedNote"
      @action="trigger($event, card.id)"
    />

    <CancelDialog
      v-if="cancelTarget !== null"
      v-model:reason="cancelReason"
      :target="cancelTarget"
      :busy="isBusy"
      @confirm="confirmCancel()"
      @dismiss="dismissCancel()"
    />
  </section>
</template>
