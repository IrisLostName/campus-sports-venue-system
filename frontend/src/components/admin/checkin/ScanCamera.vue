<script setup lang="ts">
// 扫码页的摄像头预览（P2-1c 裁决第 3 节）：预览框随窗口缩放（约 320–480px，正方形，带取景框与扫描线），
// 点“开启摄像头”后才请求权限；离开页面、关闭或页面转入后台时停止所有视频轨道（composables/scanCamera）。
// 识别到的码经 code 事件交给页面提交；paused 为真（提交进行中）时暂停解码。减少动效时扫描线不动。
import { useScanCamera } from '../../../composables/scanCamera'
import UiBanner from '../../ui/UiBanner.vue'
import UiButton from '../../ui/UiButton.vue'

const props = defineProps<{ paused: boolean }>()
const emit = defineEmits<{ code: [code: string] }>()

const { bindVideo, phase, error, start, stop } = useScanCamera({ onCode: (code) => emit('code', code), isPaused: () => props.paused })
</script>

<template>
  <div class="camera-panel">
    <div
      class="stage"
      :data-phase="phase"
    >
      <video
        :ref="bindVideo"
        class="video"
        :class="{ live: phase === 'on' }"
        muted
        playsinline
        autoplay
        aria-label="摄像头画面"
      />
      <div
        class="frame"
        aria-hidden="true"
      />
      <div
        v-if="phase === 'on'"
        class="laser"
        aria-hidden="true"
      />
      <p
        v-if="phase !== 'on'"
        class="stage-text"
      >
        {{ phase === 'starting' ? '正在开启摄像头…' : '摄像头未开启' }}
      </p>
    </div>
    <div class="controls">
      <UiButton
        v-if="phase === 'on' || phase === 'starting'"
        variant="secondary"
        @click="stop()"
      >
        关闭摄像头
      </UiButton>
      <UiButton
        v-else
        @click="start()"
      >
        开启摄像头
      </UiButton>
      <span
        v-if="phase === 'on'"
        class="live-hint"
        role="status"
      >正在识别，请把签到码放进取景框</span>
    </div>
    <UiBanner
      v-if="error !== null"
      tone="warning"
      role="alert"
    >
      {{ error }}
    </UiBanner>
  </div>
</template>

<style scoped>
.camera-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stage {
  position: relative;
  display: grid;
  width: clamp(320px, 36vw, 480px);
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--scan-stage);
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  visibility: hidden;
}

.video.live {
  visibility: visible;
}

.frame {
  position: absolute;
  width: 62%;
  aspect-ratio: 1;
  border: 3px solid var(--scan-frame);
  border-radius: var(--radius-lg);
}

.laser {
  position: absolute;
  top: 50%;
  width: 62%;
  height: 2px;
  background: var(--scan-laser);
}

.stage-text {
  position: absolute;
  bottom: var(--space-3);
  color: var(--on-accent);
  font: var(--font-footnote);
}

.controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.live-hint {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

@media (prefers-reduced-motion: no-preference) {
  .laser {
    animation: scan-laser 1.8s ease-in-out infinite;
  }
}

@keyframes scan-laser {
  0%,
  100% {
    top: 22%;
  }

  50% {
    top: 78%;
  }
}
</style>
