<script setup lang="ts">
// 新增场馆表单（FE-6 G1）：名称（≤50）、类型、位置（≤100）、简介（≤500），长度取自 docs/13。
// 新场馆默认开放运营、不开放预约、无场地无规则，创建后到“场地与开放规则”设定。
import {
  VENUE_DESCRIPTION_MAX_LENGTH, VENUE_LOCATION_MAX_LENGTH, VENUE_NAME_MAX_LENGTH,
} from '../../../utils/fieldLimits'
import { VENUE_TYPE_OPTIONS, type VenueFormFields } from '../../../utils/sysVenueDisplay'
import UiBanner from '../../ui/UiBanner.vue'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'

const form = defineModel<VenueFormFields>('form', { required: true })

defineProps<{ error: string | null; busy: boolean }>()

defineEmits<{ submit: [] }>()
</script>

<template>
  <UiGlassCard
    tag="form"
    material="solid"
    radius="lg"
    class="form"
    aria-label="新增场馆"
    @submit.prevent="$emit('submit')"
  >
    <h2 class="heading">
      新增场馆
    </h2>
    <div class="fields">
      <UiTextField
        v-model="form.name"
        label="名称"
        :maxlength="VENUE_NAME_MAX_LENGTH"
      />
      <UiTextField
        v-model="form.venueType"
        label="类型"
        control="select"
      >
        <option value="">
          请选择
        </option>
        <option
          v-for="option in VENUE_TYPE_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </UiTextField>
      <UiTextField
        v-model="form.location"
        label="位置（可选）"
        :maxlength="VENUE_LOCATION_MAX_LENGTH"
      />
    </div>
    <UiTextField
      v-model="form.description"
      label="简介（可选）"
      control="textarea"
      rows="2"
      :maxlength="VENUE_DESCRIPTION_MAX_LENGTH"
    />
    <UiBanner
      v-if="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>
    <div>
      <UiButton
        type="submit"
        :loading="busy"
      >
        新增场馆
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  font: var(--font-headline);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}
</style>
