<script setup lang="ts" generic="T extends object">
// 管理端通用数据表（FE-5）：实色表面（docs/17 第 7 节：表格用 --color-surface）。
// 单元格默认显示 row[key]（空值显示“—”）；需要自定义时用插槽 cell-<key>，参数 { row }。无数据时显示空状态。
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'

export interface TableColumn {
  key: string
  label: string
  align?: 'end'
}

const props = defineProps<{
  columns: TableColumn[]
  rows: T[]
  rowKey: keyof T & string
  caption: string
  emptyTitle: string
}>()

function cellText(row: T, key: string): string {
  const value: unknown = Reflect.get(row, key)
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function keyOf(row: T): string {
  return String(Reflect.get(row, props.rowKey))
}
</script>

<template>
  <UiGlassCard
    material="solid"
    :padding="0"
    radius="lg"
    class="table-card"
  >
    <UiEmptyState
      v-if="rows.length === 0"
      :title="emptyTitle"
    />
    <table
      v-else
      class="table"
    >
      <caption class="sr-only">
        {{ caption }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{ end: column.align === 'end' }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="keyOf(row)"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            :class="{ end: column.align === 'end' }"
          >
            <slot
              :name="`cell-${column.key}`"
              :row="row"
            >
              {{ cellText(row, column.key) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </UiGlassCard>
</template>

<style scoped>
.table-card {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font: var(--font-callout);
}

th {
  padding: var(--space-3) var(--space-4);
  background: var(--admin-fill-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

td {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-separator);
  vertical-align: top;
}

/* UI-2b：行悬停为浅灰底（Arco 表格）。 */
tbody tr:hover td {
  background: var(--admin-fill-1);
}

.end {
  text-align: right;
}
</style>
