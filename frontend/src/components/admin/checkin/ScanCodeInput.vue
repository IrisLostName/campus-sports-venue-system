<script setup lang="ts">
// 扫码枪 / 手动输入（P2-1c 裁决第 3 节）：输入框聚焦时扫码枪的回车即提交；每次回车都提交（不去重），
// 提交后清空并重新聚焦。进入页面时自动聚焦，便于直接使用扫码枪。
// 上一次提交仍在进行（busy）时回车：不清空、不丢弃，提示稍候（审计 N1）；回车由输入框自己处理，
// 因为提交按钮在进行中是禁用的，浏览器不会对它做隐式提交。
import { onMounted, ref, useTemplateRef } from 'vue'

import UiButton from '../../ui/UiButton.vue'

const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ submit: [code: string] }>()

const text = ref('')
const input = useTemplateRef('input')
const waitNotice = ref(false)

function focus(): void {
  input.value?.focus()
}

function submit(): void {
  if (props.busy) {
    waitNotice.value = true
    focus()
    return
  }
  waitNotice.value = false
  const code = text.value
  text.value = ''
  focus()
  if (code.trim() !== '') {
    emit('submit', code)
  }
}

onMounted(focus)

defineExpose({ focus })
</script>

<template>
  <form
    class="manual"
    @submit.prevent="submit"
  >
    <input
      ref="input"
      v-model="text"
      aria-label="签到码"
      class="code-input"
      type="text"
      autocomplete="off"
      spellcheck="false"
      maxlength="200"
      placeholder="扫码枪输入或手动粘贴签到码，回车提交"
      @keydown.enter.prevent="submit"
    >
    <UiButton
      type="submit"
      :loading="busy"
    >
      签到
    </UiButton>
  </form>
  <p
    v-if="waitNotice"
    class="wait-notice"
    role="status"
  >
    上一次签到正在处理，请稍候
  </p>
</template>

<style scoped>
.manual {
  display: flex;
  gap: var(--space-2);
}

.code-input {
  flex: 1;
  min-width: 0;
  min-height: var(--control-min-height);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-sm);
  background: var(--admin-fill-1);
  color: var(--color-text);
  font: var(--font-footnote);
  font-family: ui-monospace, monospace;
}

.wait-notice {
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.code-input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}
</style>
