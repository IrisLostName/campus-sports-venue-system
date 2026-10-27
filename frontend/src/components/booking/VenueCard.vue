<script setup lang="ts">
// 订场第一层的场馆宽卡片（UI-3 裁决第 1 节第一层）：封面、标志、名称、场地数与位置（或“暂未开放预约”）、置顶的一条场馆公告。
// 可点的只有 button.venue（未开放预约的场馆 disabled，不可进入，沿用 B2）；公告放在按钮之外，不并入按钮的名称。
import type { VenueSummary } from '../../api/types'
import { NOT_BOOKABLE_TEXT } from '../../utils/bookingDisplay'
import type { AnnouncementItem } from '../../utils/reservationDisplay'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'
import VenueMedia from './VenueMedia.vue'

defineProps<{ venue: VenueSummary; pinned: AnnouncementItem | null }>()

defineEmits<{ select: [venueId: number] }>()
</script>

<template>
  <UiGlassCard
    tag="li"
    class="venue-card"
    :class="{ closed: !venue.bookable }"
    :padding="0"
    radius="2xl"
    :data-venue-id="venue.id"
  >
    <button
      type="button"
      class="venue"
      :disabled="!venue.bookable"
      @click="$emit('select', venue.id)"
    >
      <span class="cover">
        <VenueMedia
          :venue-id="venue.id"
          :venue-name="venue.name"
          kind="cover"
        />
      </span>
      <span class="body">
        <span class="logo">
          <VenueMedia
            :venue-id="venue.id"
            :venue-name="venue.name"
            kind="logo"
          />
        </span>
        <span class="text">
          <span class="name">{{ venue.name }}</span>
          <span
            v-if="venue.bookable"
            class="meta"
          >
            {{ venue.resourceCount }} 个场地<template v-if="venue.location !== null"> · {{ venue.location }}</template>
          </span>
          <span
            v-else
            class="meta not-bookable"
          >
            {{ NOT_BOOKABLE_TEXT }}
          </span>
        </span>
        <svg
          v-if="venue.bookable"
          class="arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
    <p
      v-if="pinned !== null"
      class="pinned"
      role="note"
      aria-label="场馆公告"
    >
      <UiIcon
        name="megaphone"
        class="pinned-icon"
      />
      <span class="pinned-text">
        <span class="pinned-title">{{ pinned.title }}</span>
        <span
          v-if="pinned.content !== null"
          class="pinned-content"
        >{{ pinned.content }}</span>
      </span>
    </p>
  </UiGlassCard>
</template>

<style scoped>
.venue-card {
  overflow: hidden;
}

.venue {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  text-align: start;
  cursor: pointer;
  transition: transform var(--motion-fast) var(--ease-standard);
}

.venue:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.venue:disabled {
  cursor: not-allowed;
}

.venue:focus-visible {
  outline-offset: -3px;
}

.cover {
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.body {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

/* 标志压在封面下缘：圆形，带玻璃边线。 */
.logo {
  flex: none;
  width: 56px;
  height: 56px;
  margin-top: calc(-1 * var(--space-8));
  overflow: hidden;
  border: var(--glass-border);
  border-radius: var(--radius-capsule);
  background: var(--color-surface);
  box-shadow: var(--glass-shadow);
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font: var(--font-headline);
}

.meta {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.arrow {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
}

.closed .cover,
.closed .logo {
  opacity: 0.6;
}

.pinned {
  display: flex;
  gap: var(--space-2);
  margin: 0 var(--space-4) var(--space-4);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning) var(--tint-strength), transparent);
}

.pinned-icon {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  color: var(--color-text-secondary);
}

.pinned-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pinned-title {
  font: var(--font-callout);
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* 卡片上只露两行，完整内容在时段层的“场馆公告”。 */
.pinned-content {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
</style>
