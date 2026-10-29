// P2-2c：确认层同行人名单的“移除”按钮，点击区至少 44×44（docs/17 第 4 节），读 CompanionPicker.vue 的作用域样式核对。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(new URL('../../src/components/booking/CompanionPicker.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('同行人“移除”按钮的触控区', () => {
  it('min-width 与 min-height 都是 44px', () => {
    const rule = /\n\.remove \{([^}]*)\}/.exec(SOURCE)?.[1] ?? ''
    expect(rule).toMatch(/min-width: 44px;/)
    expect(rule).toMatch(/min-height: 44px;/)
  })
})
