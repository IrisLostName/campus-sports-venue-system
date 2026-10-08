<script setup lang="ts">
import { computed, onMounted } from 'vue'

import LogoutButton from '../../components/LogoutButton.vue'
import ProfileCard from '../../components/me/ProfileCard.vue'
import RepairSection from '../../components/me/RepairSection.vue'
import ReservationCardView from '../../components/reservation/ReservationCard.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
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
    <h1 class="page-title">
      我的
    </h1>

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

      <UiBanner
        v-if="loadError !== null"
        class="error"
        tone="danger"
        role="alert"
      >
        <p>{{ loadError }}</p>
        <UiButton
          variant="plain"
          @click="board.load()"
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

      <UiButton
        v-if="hasMore"
        variant="secondary"
        class="more"
        block
        :disabled="loadingMore"
        @click="board.loadMore()"
      >
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </UiButton>
    </section>

    <RepairSection />
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

h2 {
  padding-inline: var(--space-1);
  font: var(--font-title);
}
</style>
