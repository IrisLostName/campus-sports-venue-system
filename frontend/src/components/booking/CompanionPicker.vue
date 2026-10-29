<script setup lang="ts">
// 确认预约步骤里的“同行好友（可选）”（P2-2c 裁决第 1 节；观感见 prototypes/user-tweaks-demo 第 ④ 屏）：
// 输入用户名、学号或手机号后回车或点“添加”精确查找；名单以“头像首字 + 姓名”显示，可逐个移除；满 6 位后输入框与按钮不可用。
// 查找、去重与上限由 bookingCompanions 负责，这里只渲染并管理焦点：
// 加满第 6 位后焦点移到最后一位的“移除”按钮；移除后焦点移到下一位、上一位，没有则回到输入框。
import { computed, nextTick, useTemplateRef, watch } from 'vue'

import type { Companion } from '../../api/types'
import {
  COMPANION_QUERY_MAX_LENGTH, COMPANION_TEXTS, MAX_COMPANIONS, companionCounter, initialOf,
} from '../../utils/companionDisplay'
import UiButton from '../ui/UiButton.vue'
import UiTextField from '../ui/UiTextField.vue'

const props = defineProps<{
  companions: Companion[]
  looking: boolean
  notice: string | null
  disabled: boolean        // 提交进行中
}>()

const query = defineModel<string>('query', { required: true })

const emit = defineEmits<{ lookup: []; remove: [userId: number] }>()

const root = useTemplateRef('root')
const removeButtons = useTemplateRef('removes')
const full = computed(() => props.companions.length >= MAX_COMPANIONS)
const inputLocked = computed(() => props.disabled || full.value)

function focusInput(): void {
  root.value?.querySelector('input')?.focus()
}

// v-for 里的模板引用数组不保证顺序，按 data-index 找。
function focusRemove(index: number): void {
  removeButtons.value?.find((button) => button.dataset.index === String(index))?.focus()
}

function lookup(): void {
  if (!props.looking && !inputLocked.value) {
    emit('lookup')
  }
}

async function remove(index: number, userId: number): Promise<void> {
  emit('remove', userId)
  await nextTick()
  const remaining = props.companions.length
  if (remaining === 0) {
    focusInput()
  } else {
    focusRemove(Math.min(index, remaining - 1))
  }
}

watch(() => props.companions.length, async (count, before) => {
  if (count > before && count >= MAX_COMPANIONS) {
    await nextTick()
    focusRemove(count - 1)
  }
})
</script>

<template>
  <section
    ref="root"
    class="companions"
    aria-label="同行好友"
  >
    <div class="search">
      <UiTextField
        v-model="query"
        class="field"
        :label="COMPANION_TEXTS.label"
        type="text"
        autocomplete="off"
        :maxlength="COMPANION_QUERY_MAX_LENGTH"
        :placeholder="COMPANION_TEXTS.placeholder"
        :disabled="inputLocked"
        :error="notice"
        @keydown.enter.prevent="lookup()"
      />
      <UiButton
        variant="secondary"
        class="add"
        :disabled="inputLocked"
        :loading="looking"
        @click="lookup()"
      >
        {{ looking ? '查找中…' : '添加' }}
      </UiButton>
    </div>

    <ul
      v-if="companions.length > 0"
      class="chips"
      aria-label="已添加的同行好友"
    >
      <li
        v-for="(companion, index) in companions"
        :key="companion.userId"
        class="chip"
      >
        <span
          class="avatar"
          aria-hidden="true"
        >{{ initialOf(companion.displayName) }}</span>
        <span class="name">{{ companion.displayName }}</span>
        <button
          ref="removes"
          type="button"
          class="remove"
          :data-index="index"
          :disabled="disabled"
          :aria-label="`移除${companion.displayName}`"
          @click="remove(index, companion.userId)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>

    <p
      class="counter"
      aria-live="polite"
    >
      {{ companionCounter(companions.length) }}
    </p>
  </section>
</template>

<style scoped>
.companions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.search {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.field {
  flex: 1;
  min-width: 0;
}

/* 与输入框底边对齐：标签一行（footnote）+ 间距之后才是输入框。 */
.add {
  flex: none;
  margin-top: calc(var(--space-2) + 1.4em);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  padding-left: var(--space-1);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-capsule);
  background: var(--color-surface);
  font: var(--font-callout);
}

.avatar {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent-fill);
  color: var(--on-accent);
  font: var(--font-footnote);
  font-weight: 600;
}

.name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.remove {
  display: grid;
  flex: none;
  min-width: 44px;
  min-height: 44px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-capsule);
  background: transparent;
  color: var(--color-text-secondary);
  font: var(--font-headline);
  cursor: pointer;
}

.remove:disabled {
  cursor: default;
  opacity: 0.5;
}

.remove:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.counter {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}
</style>
