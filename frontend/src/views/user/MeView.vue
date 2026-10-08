<script setup lang="ts">
import { computed, onMounted } from 'vue'

import LogoutButton from '../../components/LogoutButton.vue'
import ProfileCard from '../../components/me/ProfileCard.vue'
import RepairSection from '../../components/me/RepairSection.vue'
import ReservationCardView from '../../components/reservation/ReservationCard.vue'
import { useMeBoard } from '../../composables/meBoard'
import { useAuthStore } from '../../stores/auth'
import { buildProfile } from '../../utils/meDisplay'

const auth = useAuthStore()
const profile = computed(() => (auth.user === null ? null : buildProfile(auth.user)))

const board = useMeBoard()
const {
  phase, cards, isBusy, isEmpty, busyId, loadError, hasMore, loadingMore, pageFeedback, feedbackFor, trigger,
} = board

onMounted(() => {
  void board.load()
})
</script>

<template>
  <section class="page">
    <h1>我的</h1>

    <ProfileCard
      v-if="profile !== null"
      :profile="profile"
    >
      <LogoutButton />
    </ProfileCard>

    <section
      class="history"
      aria-label="历史预约"
    >
      <h2>历史预约</h2>

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
          @click="board.load()"
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
        v-if="isEmpty"
        class="hint"
      >
        暂无历史预约
      </p>

      <ReservationCardView
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :busy="isBusy"
        :working="busyId === card.id"
        :feedback="feedbackFor(card.id)"
        @action="trigger($event, card.id)"
      />

      <button
        v-if="hasMore"
        type="button"
        class="more"
        :disabled="loadingMore"
        @click="board.loadMore()"
      >
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </button>
    </section>

    <RepairSection />
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
  margin: 0 0 8px;
  font-size: 17px;
}

.history {
  margin-bottom: 20px;
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

.more {
  display: block;
  width: 100%;
  min-height: 44px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2933;
  font-size: 16px;
  cursor: pointer;
}

.more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
