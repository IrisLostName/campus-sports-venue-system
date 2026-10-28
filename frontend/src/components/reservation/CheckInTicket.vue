<script setup lang="ts">
// 签到码浮层中的一张卡片（P2-1c 裁决已定事项第 1 条）：场馆 · 场地、预约人姓名与用户名、二维码、日期、预约时段、
// 可使用时段（含签退截止）、签到时间窗口、签到截止，以及该场馆的静态平面图（缺图显示“暂无平面图”）。
// 签到码获取失败只影响本卡片：显示错误文案与“重试”。
import type { CodeEntry } from '../../composables/checkInSheet'
import type { CheckInTicketView } from '../../utils/checkInDisplay'
import { toneForDisplayStatus } from '../../utils/statusTone'
import VenueMedia from '../booking/VenueMedia.vue'
import UiButton from '../ui/UiButton.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'
import CheckInQr from './CheckInQr.vue'

defineProps<{ ticket: CheckInTicketView; entry: CodeEntry }>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <article
    class="ticket"
    :data-reservation-id="ticket.id"
  >
    <header class="ticket-head">
      <h3 class="venue">
        {{ ticket.place }}
      </h3>
      <p class="who">
        {{ ticket.bookerText }}
      </p>
    </header>

    <div class="qr-area">
      <CheckInQr
        v-if="entry.state === 'ready'"
        :code="entry.code"
      />
      <div
        v-else-if="entry.state === 'error'"
        class="code-error"
        role="alert"
      >
        <p>签到码获取失败：{{ entry.message }}</p>
        <UiButton
          variant="secondary"
          @click="$emit('retry')"
        >
          重试
        </UiButton>
      </div>
      <p
        v-else
        class="code-loading"
      >
        签到码加载中…
      </p>
    </div>

    <p class="qr-hint">
      请向工作人员出示此码
      <UiStatusPill
        class="badge"
        :tone="toneForDisplayStatus(ticket.displayStatus)"
      >
        {{ ticket.statusLabel }}
      </UiStatusPill>
    </p>

    <dl class="facts">
      <div>
        <dt>日期</dt>
        <dd>{{ ticket.dateText }}</dd>
      </div>
      <div>
        <dt>预约时段</dt>
        <dd>{{ ticket.slotText }}</dd>
      </div>
      <template v-if="ticket.usableText !== null">
        <div>
          <dt>可使用时段</dt>
          <dd>{{ ticket.usableText }}</dd>
        </div>
        <div>
          <dt>签到时间</dt>
          <dd>{{ ticket.windowText }}</dd>
        </div>
        <div>
          <dt>签到截止</dt>
          <dd>{{ ticket.deadlineText }}</dd>
        </div>
      </template>
    </dl>

    <section class="plan">
      <h4>场馆平面图</h4>
      <div class="plan-media">
        <VenueMedia
          :venue-id="ticket.venueId"
          :venue-name="ticket.venueName"
          kind="floorplan"
          :alt="`${ticket.venueName}平面图`"
        />
      </div>
    </section>
  </article>
</template>

<style scoped>
.ticket {
  overflow: hidden;
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--glass-shadow);
}

.ticket-head {
  padding: var(--space-3) var(--space-4);
  background: var(--color-accent-fill);
  color: var(--on-accent);
}

.venue {
  font: var(--font-headline);
}

.who {
  font: var(--font-footnote);
}

.qr-area {
  display: grid;
  min-height: 226px;
  place-items: center;
  padding: var(--space-4) 0 var(--space-1);
}

.code-error,
.code-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  max-width: 260px;
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  text-align: center;
}

.code-error p {
  color: var(--color-danger-text);
}

.qr-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0 var(--space-4) var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-1) var(--space-4) var(--space-3);
  border-bottom: 1px dashed var(--color-separator);
}

.facts div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font: var(--font-callout);
}

dt {
  flex: none;
  color: var(--color-text-secondary);
}

dd {
  min-width: 0;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.plan {
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.plan h4 {
  margin-bottom: var(--space-2);
  font: var(--font-footnote);
  font-weight: 600;
}

.plan-media {
  overflow: hidden;
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-md);
}

.plan-media :deep(img) {
  height: auto;
}
</style>
