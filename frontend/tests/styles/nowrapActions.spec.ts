// FE-8 L9（FE-6 N2）：公告表操作列的“归档”按钮不竖排。
// happy-dom 不计算 CSS，这里读 SFC 的样式块文本；规则被删除或改动，测试就会变红（做法同 componentFallbacks.spec.ts）。
// 窄屏下的实际表现由 docs/evidence/FE-8-polish.md 里的浏览器测量佐证。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function styleOf(path: string): string {
  const source = readFileSync(new URL(`../../src/components/${path}`, import.meta.url), 'utf8')
  return (/<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '').replace(/\s+/g, ' ')
}

describe('AnnouncementTable 操作列', () => {
  it('.archive 设置了 white-space: nowrap', () => {
    expect(styleOf('admin/announcements/AnnouncementTable.vue')).toContain('.archive { white-space: nowrap; }')
  })
})
