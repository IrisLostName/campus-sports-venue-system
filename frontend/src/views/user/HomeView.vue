<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AnnouncementList from '../../components/home/AnnouncementList.vue'
import EmptyReservation from '../../components/home/EmptyReservation.vue'
import SummaryCard from '../../components/home/SummaryCard.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import { useHomeBoard } from '../../composables/homeBoard'
import { useAuthStore } from '../../stores/auth'
import { greetingLine, WELCOME_LINE } from '../../utils/greeting'
import { nowShanghai } from '../../utils/shanghaiTime'

// UI-4：标题换成按时段的问候语（进入页面时的钟点）；标签页标题仍是“首页”（路由 meta）。
const auth = useAuthStore()
const greeting = computed(() => greetingLine(nowShanghai(), auth.user?.displayName))

const { phase, sections, announcementItems, announcementsLoaded, announcementError, load } = useHomeBoard()

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <header class="greeting">
      <h1 class="page-title">
        {{ greeting }}
      </h1>
      <p class="welcome">
        {{ WELCOME_LINE }}
      </p>
    </header>

    <p
      v-if="phase === 'loading'"
      class="hint"
    >
      加载中…
    </p>

    <template
      v-for="section in sections"
      :key="section.kind"
    >
      <SummaryCard
        v-if="section.kind === 'summary'"
        :summary="section.summary"
        :more-count="section.moreCount"
      />
      <EmptyReservation v-else-if="section.kind === 'empty'" />
      <UiBanner
        v-else-if="section.kind === 'reservationError'"
        class="error"
        tone="danger"
        role="alert"
      >
        <p>{{ section.message }}</p>
        <UiButton
          variant="plain"
          @click="load()"
        >
          重试
        </UiButton>
      </UiBanner>
      <AnnouncementList
        v-else-if="section.kind === 'announcements'"
        :items="announcementItems"
        :loaded="announcementsLoaded"
        :error="announcementError"
      />
    </template>
  </section>
</template>

<style scoped>
.greeting {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.welcome {
  padding-inline: var(--space-1);
  color: var(--color-text-secondary);
  font: var(--font-callout);
}
</style>
