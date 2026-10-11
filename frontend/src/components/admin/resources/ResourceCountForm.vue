<script setup lang="ts">
// 设定场地数量（FE-5 P3）：数量 0–50；名称前缀（≤40）与场地类型可留空，场馆当前没有任何场地时必填（前端提示）。
import type { CountForm } from '../../../composables/adminResources'
import { NAME_PREFIX_MAX_LENGTH, RESOURCE_COUNT_MAX, RESOURCE_TYPE_OPTIONS } from '../../../utils/adminResourceDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'

const form = defineModel<CountForm>('form', { required: true })

defineProps<{ empty: boolean; busy: boolean }>()

defineEmits<{ submit: [] }>()
</script>

<template>
  <UiGlassCard
    tag="form"
    material="solid"
    radius="lg"
    class="stack-form"
    aria-label="设定场地数量"
    @submit.prevent="$emit('submit')"
  >
    <h2 class="section-heading">
      设定场地数量
    </h2>
    <div class="fields">
      <UiTextField
        v-model="form.count"
        label="场地数量"
        inputmode="numeric"
        :placeholder="`0–${RESOURCE_COUNT_MAX}`"
      />
      <UiTextField
        v-model="form.namePrefix"
        :label="empty ? '名称前缀（必填）' : '名称前缀（可选）'"
        :maxlength="NAME_PREFIX_MAX_LENGTH"
      />
      <UiTextField
        v-model="form.resourceType"
        :label="empty ? '场地类型（必填）' : '场地类型（可选）'"
        control="select"
      >
        <option value="">
          请选择
        </option>
        <option
          v-for="option in RESOURCE_TYPE_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </UiTextField>
    </div>
    <p
      v-if="empty"
      class="hint"
    >
      该场馆还没有场地，请填写名称前缀和场地类型。
    </p>
    <div>
      <UiButton
        type="submit"
        :loading="busy"
      >
        设定数量
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>

.fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
