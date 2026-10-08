<script setup lang="ts">
import { onMounted } from 'vue'

import AnnouncementList from '../../components/home/AnnouncementList.vue'
import EmptyReservation from '../../components/home/EmptyReservation.vue'
import SummaryCard from '../../components/home/SummaryCard.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import { useHomeBoard } from '../../composables/homeBoard'

const { phase, sections, announcementItems, announcementsLoaded, announcementError, load } = useHomeBoard()

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <h1 class="page-title">
      首页
    </h1>

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
