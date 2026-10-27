<script setup lang="ts">
// 扫码枪 / 手动输入（P2-1c 裁决第 3 节）：输入框聚焦时扫码枪的回车即提交；每次回车都提交（不去重），
// 提交后清空并重新聚焦。进入页面时自动聚焦，便于直接使用扫码枪。
import { onMounted, ref, useTemplateRef } from 'vue'

import UiButton from '../../ui/UiButton.vue'

defineProps<{ busy: boolean }>()
const emit = defineEmits<{ submit: [code: string] }>()

const text = ref('')
const input = useTemplateRef('input')

function focus(): void {
  input.value?.focus()
}

function submit(): void {
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
    >
    <UiButton
      type="submit"
      :loading="busy"
    >
      签到
    </UiButton>
  </form>
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

.code-input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}
</style>
