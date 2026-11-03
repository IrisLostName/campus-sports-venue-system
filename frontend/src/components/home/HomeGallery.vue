<script setup lang="ts">
// 首页图集（UI-6）：位于预约卡片与系统公告之间。图片放进 public/media/gallery/ 后重新构建即可出现，目录为空时不渲染。
// 一次只显示一张，按比例完整缩放进固定高度的框里（不裁切、不拉伸）；只渲染当前与下一张，其余不加载。
// 用 div + role="region"，不用 section：首页的 section[aria-label] 只有“最近的预约”和“系统公告”两块。
import { computed } from 'vue'
import files from 'virtual:home-gallery'

import { useHomeGallery } from '../../composables/homeGallery'
import { galleryAlt, galleryUrl } from '../../utils/gallery'
import UiGlassCard from '../ui/UiGlassCard.vue'

const props = withDefaults(defineProps<{ images?: readonly string[] }>(), { images: () => files })

const { order, index, reducedMotion, show } = useHomeGallery(props.images)
const total = order.length
const current = computed(() => order[index.value])
const next = computed(() => (total > 1 ? order[(index.value + 1) % total] : undefined))
</script>

<template>
  <UiGlassCard
    v-if="total > 0"
    class="home-gallery"
    role="region"
    aria-label="场馆图集"
    :padding="0"
  >
    <div class="frame">
      <Transition
        name="gallery-fade"
        :css="!reducedMotion"
      >
        <img
          :key="current"
          class="photo"
          :src="galleryUrl(current ?? '')"
          :alt="galleryAlt(index, total)"
          loading="lazy"
          decoding="async"
        >
      </Transition>
      <img
        v-if="next !== undefined"
        :key="`next-${next}`"
        class="photo preload"
        :src="galleryUrl(next)"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      >
    </div>
    <div
      v-if="total > 1"
      class="dots"
    >
      <button
        v-for="(name, i) in order"
        :key="name"
        type="button"
        class="dot"
        :aria-label="`第 ${i + 1} 张`"
        :aria-current="i === index ? 'true' : undefined"
        @click="show(i)"
      />
    </div>
  </UiGlassCard>
</template>

<style scoped>
.home-gallery {
  overflow: hidden;
}

.frame {
  position: relative;
  height: 240px;
}

.photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preload {
  opacity: 0;
  pointer-events: none;
}

.gallery-fade-enter-active,
.gallery-fade-leave-active {
  transition: opacity var(--motion-slow) var(--ease-standard);
}

.gallery-fade-enter-from,
.gallery-fade-leave-to {
  opacity: 0;
}

.dots {
  display: flex;
  justify-content: center;
  padding-block: var(--space-1);
}

/* 点击区 24px，视觉上是 8px 的圆点。 */
.dot {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.dot::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: var(--radius-capsule);
  background: var(--color-text-tertiary);
}

.dot[aria-current='true']::before {
  background: var(--color-accent);
}

.dot:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  border-radius: var(--radius-capsule);
}
</style>
