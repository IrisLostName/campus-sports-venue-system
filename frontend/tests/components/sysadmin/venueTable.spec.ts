// FE-8 L7 / L14：VenueTable 直接挂载——行内容、开关、按钮与事件，以及“场馆已关闭，用户端不可预约”的说明。
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import VenueTable from '../../../src/components/sys-admin/venues/VenueTable.vue'
import type { VenueRowView } from '../../../src/utils/sysVenueDisplay'

function row(overrides: Partial<VenueRowView> = {}): VenueRowView {
  return {
    id: 1, name: '网球馆', typeLabel: '网球', locationText: null, statusLabel: '开放', open: true,
    bookingEnabled: true, bookingHint: null, resourceCount: 4, ...overrides,
  }
}

function mountTable(rows: VenueRowView[], busy = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
  return mount(VenueTable, { props: { rows, busy }, global: { plugins: [router] } })
}

describe('L7 关闭但开关仍开的场馆', () => {
  it('bookingHint 非空：开关那一格显示说明，开关仍是“已开放”；为空则不渲染说明', () => {
    const table = mountTable([
      row({ id: 1, open: false, statusLabel: '已关闭', bookingHint: '场馆已关闭，用户端不可预约' }),
      row({ id: 2, name: '游泳馆', open: false, statusLabel: '已关闭', bookingEnabled: false }),
    ])
    const cells = table.findAll('tbody tr').map((tr) => tr.findAll('td')[4])

    expect(cells[0]?.get('.switch').text()).toBe('已开放')
    expect((cells[0]?.get('input[role="switch"]').element as HTMLInputElement).checked).toBe(true)
    expect(cells[0]?.get('.booking-hint').text()).toBe('场馆已关闭，用户端不可预约')
    expect(cells[1]?.text()).toBe('未开放')
    expect(cells[1]?.find('.booking-hint').exists()).toBe(false)
  })
})
