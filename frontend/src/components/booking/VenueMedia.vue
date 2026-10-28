<script setup lang="ts">
// 场馆封面或标志（UI-3）：按静态文件约定取图（utils/venueMedia），图片只作装饰（alt 为空，名称由卡片文字提供）。
// 缺图时 <img> 触发 error，换成中性占位：封面是浅灰底加场地图标，标志是场馆名的第一个字。
// 平面图（P2-1c）带内容，由调用方给出替代文字 alt；缺图占位是浅灰底加文字“暂无平面图”（可读）。
import { computed, ref, watch } from 'vue'

import { venueInitial, venueMediaUrl, type VenueMediaKind } from '../../utils/venueMedia'
import UiIcon from '../ui/UiIcon.vue'

const props = withDefaults(defineProps<{ venueId: number; venueName: string; kind: VenueMediaKind; alt?: string }>(), { alt: '' })

const failed = ref(false)
const src = computed(() => venueMediaUrl(props.venueId, props.kind))

watch(src, () => {
  failed.value = false
})
</script>

<template>
  <img
    v-if="!failed"
    class="media"
    :class="`media--${kind}`"
    :src="src"
    :alt="alt"
    decoding="async"
    @error="failed = true"
  >
  <span
    v-else-if="kind === 'floorplan'"
    class="media placeholder media--floorplan"
    data-placeholder="floorplan"
  >暂无平面图</span>
  <span
    v-else
    class="media placeholder"
    :class="`media--${kind}`"
    :data-placeholder="kind"
    aria-hidden="true"
  >
    <UiIcon
      v-if="kind === 'cover'"
      name="court"
      class="placeholder-icon"
    />
    <template v-else>{{ venueInitial(venueName) }}</template>
  </span>
</template>

<style scoped>
.media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

/* 封面占位：中性灰的浅色底（只用令牌），图标是装饰。 */
.placeholder.media--cover {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-neutral) 22%, var(--color-surface)),
      color-mix(in srgb, var(--color-neutral) 8%, var(--color-surface))
    );
}

.placeholder-icon {
  width: 44px;
  height: 44px;
  color: var(--color-text-tertiary);
}

.placeholder.media--floorplan {
  aspect-ratio: 2 / 1;
  height: auto;
  background: color-mix(in srgb, var(--color-neutral) 12%, var(--color-surface));
  font: var(--font-footnote);
}

.placeholder.media--logo {
  background: color-mix(in srgb, var(--color-neutral) 16%, var(--color-surface));
  font: var(--font-headline);
}
</style>
