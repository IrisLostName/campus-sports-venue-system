<script setup lang="ts">
// 签到码浮层（P2-1c 裁决第 2 节，观感参照 prototypes/checkin-demo）：从底部弹起；每个可出示的预约一张卡片，
// 左右滑动（滚动吸附）切换并有指示点；按钮、遮罩、Esc 都可关闭（Esc 只由最上层浮层响应，composables/escapeClose）。
// 由“预约”页按需异步加载（二维码库因此只在这个分包之后加载）。“关闭”与指示点的触控区都是 44×44。
// 焦点：打开时聚焦“关闭”，Tab 在浮层内循环，非当前卡片加 inert；关闭后的焦点见 composables/checkInCarousel。
// 减少动效：不做弹出动画、指示点过渡，切换卡片不平滑滚动。
// 不复用 UiSheet：它带固定的标题与内边距，且由 UI-2b 基线锁定；这里只用同一套令牌。
import { useId } from 'vue'

import { useCheckInCarousel } from '../../composables/checkInCarousel'
import type { CodeEntry } from '../../composables/checkInSheet'
import { useEscapeClose } from '../../composables/escapeClose'
import type { CheckInTicketView } from '../../utils/checkInDisplay'
import CheckInTicket from './CheckInTicket.vue'

const props = defineProps<{
  open: boolean
  tickets: CheckInTicketView[]
  startIndex: number
  entryOf: (id: number) => CodeEntry
}>()

const emit = defineEmits<{ close: []; retry: [id: number] }>()

const titleId = useId()
const { bindPanel, bindClose, bindCarousel, index, scrollToIndex, onScroll, onCarouselKey, onPanelKey, settleFocus } = useCheckInCarousel({
  open: () => props.open, count: () => props.tickets.length, startIndex: () => props.startIndex,
})

const close = (): void => emit('close')

useEscapeClose(() => props.open, close)

defineExpose({ settleFocus })
</script>

<template>
  <Transition
    name="checkin-sheet"
    appear
  >
    <div
      v-if="open"
      class="backdrop"
      data-checkin-sheet
      @click.self="close"
    >
      <section
        :ref="bindPanel"
        class="sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown="onPanelKey"
      >
        <div
          class="grabber"
          aria-hidden="true"
        />
        <header class="sheet-head">
          <h2 :id="titleId">
            签到码
          </h2>
          <button
            :ref="bindClose"
            type="button"
            class="close"
            aria-label="关闭"
            @click="close"
          >
            <span
              class="close-icon"
              aria-hidden="true"
            >×</span>
          </button>
        </header>

        <p
          v-if="tickets.length === 0"
          class="empty"
        >
          暂无可出示的签到码
        </p>
        <div
          v-else
          :ref="bindCarousel"
          class="carousel"
          tabindex="0"
          aria-label="签到码卡片，左右滑动或用方向键切换"
          @scroll="onScroll"
          @keydown="onCarouselKey"
        >
          <div
            v-for="(ticket, position) in tickets"
            :key="ticket.id"
            class="slide"
            role="group"
            aria-roledescription="卡片"
            :aria-label="`第 ${position + 1} 张，共 ${tickets.length} 张`"
            :inert="position !== index"
          >
            <CheckInTicket
              :ticket="ticket"
              :entry="entryOf(ticket.id)"
              @retry="emit('retry', ticket.id)"
            />
          </div>
        </div>

        <template v-if="tickets.length > 1">
          <p class="swipe-hint">
            左右滑动切换预约
          </p>
          <div class="dots">
            <button
              v-for="(ticket, position) in tickets"
              :key="ticket.id"
              type="button"
              class="dot"
              :class="{ on: position === index }"
              :aria-label="`第 ${position + 1} 张，共 ${tickets.length} 张`"
              :aria-current="position === index ? 'true' : undefined"
              @click="scrollToIndex(position, true)"
            />
          </div>
        </template>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-scrim);
}

.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--phone-width);
  height: 92%;
  padding-bottom: env(safe-area-inset-bottom);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  background: var(--color-canvas);
}

.grabber {
  flex: none;
  width: 40px;
  height: 5px;
  margin: var(--space-2) auto 0;
  border-radius: var(--radius-capsule);
  background: var(--color-text-tertiary);
}

.sheet-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4) var(--space-1);
}

.sheet-head h2 {
  font: var(--font-headline);
}

.close {
  display: grid;
  width: 44px;
  height: 44px;
  margin: -6px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.close-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-separator);
  font-size: 20px;
  line-height: 1;
}

.close:focus-visible,
.carousel:focus-visible,
.dot:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.empty {
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-secondary);
  text-align: center;
}

.carousel {
  display: flex;
  flex: 1;
  min-height: 0;
  padding-top: var(--space-2);
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.carousel::-webkit-scrollbar {
  display: none;
}

.slide {
  flex: 0 0 100%;
  padding: 0 var(--space-4) var(--space-3);
  overflow-y: auto;
  scroll-snap-align: center;
}

.swipe-hint {
  flex: none;
  color: var(--color-text-secondary);
  font: var(--font-caption);
  text-align: center;
}

.dots {
  display: flex;
  flex: none;
  justify-content: center;
  padding: 0 0 var(--space-1);
}

/* 触控区 44×44（docs/17 第 4 节，审计 F1）；看得见的“关闭”圆形仍为 32px，圆点由 ::before 画（7×7，当前项 18×7）。 */
.dot {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-capsule);
  background: transparent;
  cursor: pointer;
}

.dot::before {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-capsule);
  background: var(--color-text-tertiary);
  content: "";
}

.dot.on::before {
  width: 18px;
  background: var(--color-accent);
}

@media (prefers-reduced-motion: no-preference) {
  .dot::before {
    transition: width var(--motion-normal) var(--ease-standard), background var(--motion-normal) var(--ease-standard);
  }

  .checkin-sheet-enter-active,
  .checkin-sheet-leave-active {
    transition: opacity var(--motion-slow) var(--ease-standard);
  }

  .checkin-sheet-enter-active .sheet,
  .checkin-sheet-leave-active .sheet {
    transition: transform var(--motion-slow) var(--ease-standard);
  }

  .checkin-sheet-enter-from,
  .checkin-sheet-leave-to {
    opacity: 0;
  }

  .checkin-sheet-enter-from .sheet,
  .checkin-sheet-leave-to .sheet {
    transform: translateY(100%);
  }
}
</style>
