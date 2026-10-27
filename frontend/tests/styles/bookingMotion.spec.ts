// UI-3 裁决第 0 节第 3 条、第 2 节“减少动效时无动画”、第 4 节第 5 条：
// 弹簧弹出只在 prefers-reduced-motion: no-preference 时出现；减少动效时层的缩放与位移步长在组件内归零；
// 其余位移与缩放只用会被令牌归零的变量（--press-scale、--slide-distance）；时长只用 --motion-* 令牌（减少动效时收到 --motion-fast 以内）。
// tokens.css 不改（由 tokenScope / adminTokenScope 两份测试保证）。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FILES = ['BookingLayer.vue', 'MonthCalendar.vue', 'VenueCard.vue', 'VenueMedia.vue', 'SlotsLayer.vue', 'VenueList.vue']

function styleOf(name: string): string {
  const source = readFileSync(new URL(`../../src/components/booking/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  return (/<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '')
}

// 取出 @media (...) 块的内容（按花括号配对）。
function mediaBlocks(css: string, query: string): string[] {
  const blocks: string[] = []
  let from = 0
  for (;;) {
    const start = css.indexOf(`@media (${query})`, from)
    if (start < 0) {
      return blocks
    }
    const open = css.indexOf('{', start)
    let depth = 1
    let index = open + 1
    while (depth > 0 && index < css.length) {
      depth += css[index] === '{' ? 1 : css[index] === '}' ? -1 : 0
      index += 1
    }
    blocks.push(css.slice(open + 1, index - 1))
    from = index
  }
}

function withoutMedia(css: string, query: string): string {
  return mediaBlocks(css, query).reduce((rest, block) => rest.replace(block, ''), css)
}

const LAYER = styleOf('BookingLayer.vue')

describe('弹簧弹出只在未要求减少动效时出现', () => {
  it('booking-layer-pop 的关键帧与使用都在 no-preference 块内，块外没有', () => {
    const inside = mediaBlocks(LAYER, 'prefers-reduced-motion: no-preference').join('\n')
    expect(inside).toContain('@keyframes booking-layer-pop')
    expect(inside).toMatch(/animation: booking-layer-pop /)
    expect(withoutMedia(LAYER, 'prefers-reduced-motion: no-preference')).not.toContain('booking-layer-pop')
  })

  it('块外唯一的动画是只改透明度的淡入', () => {
    const outside = withoutMedia(LAYER, 'prefers-reduced-motion: no-preference')
    const animations = Array.from(outside.matchAll(/animation: ([a-z-]+)/g)).map((match) => match[1])
    expect(animations).toEqual(['booking-layer-fade'])
    const fade = /@keyframes booking-layer-fade \{([\s\S]*?)\}\s*\}/.exec(outside)?.[1] ?? ''
    expect(fade.replace(/\s+/g, ' ').trim()).toBe('from { opacity: 0;')
  })

  it('减少动效时层的缩放、位移步长与被盖住时的整体上移都归零', () => {
    const reduce = mediaBlocks(LAYER, 'prefers-reduced-motion: reduce').join('\n')
    expect(reduce).toContain('--layer-scale-step: 0;')
    expect(reduce).toContain('--layer-offset-step: 0px;')
    expect(reduce).toContain('--layer-lift-factor: 0;')
  })

  it('层深的变换只由两个步长与（乘了开关的）上移决定；关闭时的位移用 --slide-distance', () => {
    const outside = withoutMedia(LAYER, 'prefers-reduced-motion: no-preference')
    const transforms = Array.from(outside.matchAll(/transform:([^;]+);/g)).map((match) => (match[1] ?? '').replace(/\s+/g, ' ').trim())
    expect(transforms).toEqual([
      'translateY(calc(var(--depth) * var(--layer-offset-step) - var(--lift, 0px) * var(--layer-lift-factor))) scale(calc(1 - var(--depth) * var(--layer-scale-step)))',
      'translateY(var(--slide-distance))',
    ])
  })
})

describe('其余订场组件', () => {
  it.each(FILES.filter((name) => name !== 'BookingLayer.vue'))('%s：没有动画；缩放只用 --press-scale', (name) => {
    const css = styleOf(name)
    expect(css).not.toMatch(/animation:|@keyframes/)
    const transforms = Array.from(css.matchAll(/transform:([^;]+);/g)).map((match) => (match[1] ?? '').trim())
    transforms.forEach((value) => expect(value).toBe('scale(var(--press-scale))'))
  })

  it.each(FILES)('%s：过渡与动画的时长只用 --motion-* 令牌', (name) => {
    const css = styleOf(name)
    const durations = Array.from(css.matchAll(/(?:transition|animation):([^;]+);/g)).map((match) => match[1] ?? '')
    durations.forEach((value) => expect(value).not.toMatch(/\d+m?s\b/))
  })
})
