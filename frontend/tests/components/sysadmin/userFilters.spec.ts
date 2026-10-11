// FE-8 L14（FE-6 N7 的回归断言）：用户筛选的关键字输入框没有 maxlength（文档对关键字长度没有规定，不自拟上限）。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UserFilters from '../../../src/components/sys-admin/users/UserFilters.vue'
import type { UserFilters as Filters } from '../../../src/composables/sysUsers'

function open(props: { showRole: boolean; busy?: boolean }, filters: Filters = { role: '', keyword: '' }) {
  return mount(UserFilters, { props: { filters, busy: false, ...props } })
}

describe('关键字输入框', () => {
  it('没有 maxlength；占位提示“用户名 / 显示名”；长文本照常输入', async () => {
    const filters: Filters = { role: '', keyword: '' }
    const form = open({ showRole: true }, filters)
    const keyword = form.get('input')

    expect(keyword.attributes('maxlength')).toBeUndefined()
    expect(keyword.attributes('placeholder')).toBe('用户名 / 显示名')
    await keyword.setValue('a'.repeat(200))
    expect(filters.keyword).toHaveLength(200)
  })

  it('showRole 才有“角色”下拉；提交表单发出 search；busy 时“查询”进入加载态', async () => {
    expect(open({ showRole: false }).find('select').exists()).toBe(false)
    const form = open({ showRole: true })

    expect(form.get('select').findAll('option').map((option) => option.text())[0]).toBe('全部')
    await form.get('form').trigger('submit')
    expect(form.emitted('search')).toHaveLength(1)
    expect(open({ showRole: true, busy: true }).get('button').attributes('aria-busy')).toBe('true')
  })
})
