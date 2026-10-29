<script setup lang="ts">
// 签到码浮层（P2-1c）按需异步加载：第一次点“出示签到码”后才挂载，二维码库随之只在那时下载。
// 关闭浮层后列表按后端状态刷新，再由浮层把焦点放到该预约卡片上（原按钮可能已换成“签退”，审计 N4）。
import { defineAsyncComponent, nextTick, onMounted, useTemplateRef } from 'vue'

import CancelDialog from '../../components/reservation/CancelDialog.vue'
import ReservationCardView from '../../components/reservation/ReservationCard.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useReservationBoard } from '../../composables/reservationBoard'
import { PATHS } from '../../router/paths'

const CheckInCodeSheet = defineAsyncComponent(() => import('../../components/reservation/CheckInCodeSheet.vue'))

const {
  phase, cards, isBusy, isEmpty, busyId, loadError, rulesError, pageFeedback, cancelTarget, cancelReason,
  feedbackFor, trigger, confirmCancel, dismissCancel, load, cancelLockedIds, cancelLockedNote, sheet, holding,
} = useReservationBoard()
const { isOpen: sheetOpen, everOpened: sheetMounted, tickets, startIndex, entryOf } = sheet
const sheetView = useTemplateRef<{ settleFocus(): void }>('sheetView')

async function closeSheet(): Promise<void> {
  await sheet.close()
  await nextTick()
  sheetView.value?.settleFocus()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="page">
    <header class="head">
      <h1 class="page-title">
        预约
      </h1>
      <!-- UI-4：无论是否已有预约都显示；达上限时仍可点，是否能订以后端裁决为准。 -->
      <UiButton
        class="new"
        :to="PATHS.booking"
      >
        ＋ 新建预约
      </UiButton>
    </header>
    <p
      v-if="holding !== null"
      class="hint limit"
    >
      <template v-if="holding.held >= holding.max">
        已达同时持有上限（{{ holding.max }} 个），取消一个预约后才能新建
      </template>
      <template v-else>
        当前 {{ holding.held }} 个预约，最多可同时持有 {{ holding.max }} 个
      </template>
    </p>

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

    <CheckInCodeSheet
      v-if="sheetMounted"
      ref="sheetView"
      :open="sheetOpen"
      :tickets="tickets"
      :start-index="startIndex"
      :entry-of="entryOf"
      @close="closeSheet()"
      @retry="sheet.retry($event)"
    />
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.limit {
  padding-inline: var(--space-1);
  text-align: right;
}
</style>
