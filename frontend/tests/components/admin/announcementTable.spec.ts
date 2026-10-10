// FE-8 L9（FE-6 N2）：公告表操作列的“归档”按钮不竖排。
// 样式规则本身由 tests/styles/nowrapActions.spec.ts 钉住（happy-dom 不计算 CSS）。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnnouncementTable from '../../../src/components/admin/announcements/AnnouncementTable.vue'
import type { AnnouncementRowView } from '../../../src/utils/announcementDisplay'

const ROWS: AnnouncementRowView[] = [
  {
    id: 1, title: '场地保养', content: '每周一 08:00–09:30 视情况关闭 1 片球场，请提前安排。', scopeLabel: '场馆公告', statusLabel: '有效',
    publishedText: '2026-10-12 09:00', publishedByName: '网球馆管理员', expiresText: null, canArchive: true,
  },
  {
    id: 2, title: '欢迎使用', content: '欢迎使用校园场馆预约系统', scopeLabel: '系统公告', statusLabel: '有效',
    publishedText: '2026-10-01 09:00', publishedByName: '系统管理员', expiresText: null, canArchive: false,
  },
]

describe('归档按钮', () => {
  it('只有可归档的行有按钮，按钮带 archive 类，点击发出 archive 事件', async () => {
    const table = mount(AnnouncementTable, { props: { rows: ROWS, caption: '场馆公告', emptyTitle: '没有公告' } })
    const buttons = table.findAll('tbody button')

    expect(buttons.map((button) => button.text())).toEqual(['归档'])
    expect(buttons[0]?.classes()).toContain('archive')
    await buttons[0]?.trigger('click')
    expect(table.emitted('archive')).toEqual([[1]])
  })

})
