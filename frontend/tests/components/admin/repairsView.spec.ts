// FE-5 P7：报修页挂载后的渲染结果（ACC-M2-07 的“报修”；演示：把一条报修推进到已解决）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

async function openRepairs() {
  return openAdminApp('/venue-admin/repairs', {
    prepare: async (h) => {
      const user = await h.clientFor('zhangsan')
      await user.createRepair({ venueId: 1, resourceId: 1, description: '球网破损' })
    },
  })
}

describe('P7 报修页', () => {
  it('显示报修列表与当前状态允许的按钮', async () => {
    const { root } = await openRepairs()
    const main = content(root)

    expect(main.get('h1').text()).toBe('报修')
    expect(main.findAll('thead th').map((th) => th.text())).toEqual(['提交时间', '场地', '报修人', '问题描述', '状态', '处理结果', '操作'])
    const cells = main.findAll('tbody tr')[0]?.findAll('td').map((td) => td.text())
    expect(cells?.slice(1, 6)).toEqual(['网球场1', '张三', '球网破损', '已提交', '—'])
    expect(main.findAll('tbody button').map((button) => button.text())).toEqual(['开始处理', '标记已解决'])
    expect(main.findAll('.ui-segmented button').map((button) => button.text())).toEqual(['全部', '已提交', '处理中', '已解决'])
  })

  it('SUBMITTED → IN_PROGRESS → RESOLVED（填处理结果），每一步按钮随状态变化', async () => {
    const { root, h } = await openRepairs()
    const main = content(root)

    await buttonIn(main, '开始处理').trigger('click')
    await flushPromises()
    expect(main.get('tbody tr').findAll('td')[4]?.text()).toBe('处理中')
    expect(main.findAll('tbody button').map((button) => button.text())).toEqual(['标记已解决'])
    expect(main.get('[role="status"]').text()).toBe('报修已更新')

    await buttonIn(main, '标记已解决').trigger('click')
    expect(main.get('[role="dialog"] h2').text()).toBe('标记已解决')
    await buttonIn(main.get('[role="dialog"]'), '确认').trigger('click')
    expect(main.get('[role="dialog"] [role="alert"]').text()).toBe('请填写处理结果')

    await main.get('[role="dialog"] textarea').setValue('已更换球网')
    await buttonIn(main.get('[role="dialog"]'), '确认').trigger('click')
    await flushPromises()

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    const row = main.get('tbody tr').findAll('td').map((td) => td.text())
    expect(row.slice(4, 6)).toEqual(['已解决', '已更换球网'])
    expect(main.findAll('tbody button')).toHaveLength(0)
    const stored = await (await h.clientFor('admin_tennis')).adminListRepairs({ venueId: 1 })
    expect(stored.items[0]).toMatchObject({ status: 'RESOLVED', resultNote: '已更换球网' })
  })

  it('状态筛选：选“已解决”后列表为空并显示空状态', async () => {
    const { root } = await openRepairs()
    const main = content(root)
    await buttonIn(main.get('.ui-segmented'), '已解决').trigger('click')
    await flushPromises()

    expect(main.find('table').exists()).toBe(false)
    expect(main.get('.ui-empty-state .title').text()).toBe('没有报修记录')
  })
})
