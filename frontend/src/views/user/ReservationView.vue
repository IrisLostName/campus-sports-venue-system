<script setup lang="ts">
import { onMounted } from 'vue'

import CancelDialog from '../../components/reservation/CancelDialog.vue'
import ReservationCardView from '../../components/reservation/ReservationCard.vue'
import { useReservationBoard } from '../../composables/reservationBoard'
import { PATHS } from '../../router/paths'

const {
  phase, cards, isBusy, isEmpty, busyId, loadError, rulesError, pageFeedback, cancelTarget, cancelReason,
  feedbackFor, trigger, confirmCancel, dismissCancel, load,
} = useReservationBoard()

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <h1>预约</h1>

    <p
      v-if="phase === 'loading'"
      class="hint"
    >
      加载中…
    </p>

    <div
      v-if="loadError !== null"
      class="error"
      role="alert"
    >
      <p>{{ loadError }}</p>
      <button
        type="button"
        @click="load()"
      >
        重试
      </button>
    </div>

    <p
      v-if="pageFeedback !== null"
      class="error"
      role="alert"
    >
      {{ pageFeedback }}
    </p>
    <p
      v-if="rulesError !== null"
      class="hint"
    >
      签到与取消说明暂时无法显示：{{ rulesError }}
    </p>

    <div
      v-if="isEmpty"
      class="empty"
    >
      <p>暂无当前预约</p>
      <RouterLink :to="PATHS.booking">
        去订场
      </RouterLink>
    </div>

    <ReservationCardView
      v-for="card in cards"
      :key="card.id"
      :card="card"
      :busy="isBusy"
      :working="busyId === card.id"
      :feedback="feedbackFor(card.id)"
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

<style scoped>
.page {
  padding: 16px;
}

h1 {
  margin: 0 0 12px;
  font-size: 22px;
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

.empty {
  padding: 32px 0;
  color: #5f6b7a;
  text-align: center;
}

.empty a {
  display: inline-block;
  min-height: 44px;
  padding: 10px 24px;
  border-radius: 8px;
  background: #0b6b4f;
  color: #ffffff;
  text-decoration: none;
}
</style>
