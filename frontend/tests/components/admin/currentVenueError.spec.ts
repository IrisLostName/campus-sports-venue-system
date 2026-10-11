// FE-8 L14（FE-6 N10 的回归断言）：useCurrentVenue() 在没有场馆上下文时抛出的错误文案不再限定“场馆管理员外壳”——
// 系统管理员外壳也会提供场馆上下文，所以措辞只说“已确定场馆的管理端外壳”。
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useCurrentVenue } from '../../../src/composables/adminVenue'

const Probe = defineComponent({
  setup() {
    useCurrentVenue()
    return () => h('div')
  },
})

describe('useCurrentVenue 在外壳之外调用', () => {
  it('抛错，文案是“页面必须在已确定场馆的管理端外壳内使用”，不含“场馆管理员外壳”', () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let message = ''
    try {
      mount(Probe)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    } finally {
      quiet.mockRestore()
    }

    expect(message).toBe('页面必须在已确定场馆的管理端外壳内使用')
    expect(message).not.toContain('场馆管理员外壳')
  })
})
