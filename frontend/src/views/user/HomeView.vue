<script setup lang="ts">
import { onMounted } from 'vue'

import AnnouncementList from '../../components/home/AnnouncementList.vue'
import EmptyReservation from '../../components/home/EmptyReservation.vue'
import SummaryCard from '../../components/home/SummaryCard.vue'
import { useHomeBoard } from '../../composables/homeBoard'

const { phase, sections, announcementItems, announcementsLoaded, announcementError, load } = useHomeBoard()

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <h1>首页</h1>

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
      <div
        v-else-if="section.kind === 'reservationError'"
        class="error"
        role="alert"
      >
        <p>{{ section.message }}</p>
        <button
          type="button"
          @click="load()"
        >
          重试
        </button>
      </div>
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
.page {
  padding: 16px;
}

h1 {
  margin: 0 0 12px;
  font-size: 22px;
}

.hint {
  margin: 0;
  color: #5f6b7a;
  font-size: 14px;
}

.error {
  color: #b3261e;
  font-size: 14px;
}

.error p {
  margin: 0 0 8px;
}
</style>
