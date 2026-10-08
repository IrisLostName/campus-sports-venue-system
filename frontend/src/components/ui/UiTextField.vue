<script setup lang="ts" generic="T extends string | number | null">
// 输入框、多行输入与下拉选择（docs/17 第 6 节）。标签文字是 <label> 的第一个子节点，控件在标签里面。
// class / style 落在最外层，其余属性（type、autocomplete、rows、placeholder…）落在控件上。
// maxlength 原样写到控件上；counter 默认关闭（不新增可见文字），打开后在控件下显示“已输入 / 上限”。
// error 非空时显示错误文案（role=alert）并把控件标记为 aria-invalid。
import { computed, useAttrs, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  label: string
  control?: 'input' | 'textarea' | 'select'
  error?: string | null
  maxlength?: number
  counter?: boolean
}>(), {
  control: 'input',
  error: null,
  maxlength: undefined,
  counter: false,
})

const model = defineModel<T>({ required: true })

const attrs = useAttrs()
const errorId = useId()
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const controlAttrs = computed(() => Object.fromEntries(
  Object.entries(attrs).filter(([name]) => name !== 'class' && name !== 'style'),
))
const describedBy = computed(() => (props.error === null ? undefined : errorId))
const countText = computed(() => (
  props.counter && props.maxlength !== undefined && typeof model.value === 'string'
    ? `${model.value.length} / ${props.maxlength}`
    : null
))
</script>

<template>
  <div
    class="ui-text-field"
    v-bind="rootAttrs"
  >
    <label class="label">
      {{ label }}
      <input
        v-if="control === 'input'"
        v-model="model"
        class="control"
        v-bind="controlAttrs"
        :maxlength="maxlength"
        :aria-invalid="error === null ? undefined : 'true'"
        :aria-describedby="describedBy"
      >
      <textarea
        v-else-if="control === 'textarea'"
        v-model="model"
        class="control"
        v-bind="controlAttrs"
        :maxlength="maxlength"
        :aria-invalid="error === null ? undefined : 'true'"
        :aria-describedby="describedBy"
      />
      <select
        v-else
        v-model="model"
        class="control"
        v-bind="controlAttrs"
        :aria-invalid="error === null ? undefined : 'true'"
        :aria-describedby="describedBy"
      >
        <slot />
      </select>
    </label>
    <span
      v-if="countText !== null"
      class="count"
    >{{ countText }}</span>
    <p
      v-if="error !== null"
      :id="errorId"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ui-text-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.control {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: var(--space-3);
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: var(--font-body);
}

textarea.control {
  resize: vertical;
}

.control::placeholder {
  color: var(--color-text-tertiary);
}

.control:focus-visible {
  border-color: var(--color-accent);
}

.control[aria-invalid="true"] {
  border-color: var(--color-danger);
}

.count {
  align-self: flex-end;
  color: var(--color-text-secondary);
  font: var(--font-caption);
}

.error {
  color: var(--color-danger-text);
  font: var(--font-footnote);
}
</style>
