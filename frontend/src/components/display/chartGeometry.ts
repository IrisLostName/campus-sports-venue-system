// 运营大屏自绘图表的几何计算（UI-2a）：只算 SVG 路径与描边参数，不含颜色与文字（文字都在 HTML 里，见各组件）。
// 坐标是 0–100 的百分比视框；SVG 用 preserveAspectRatio="none" 拉伸到绘图区，线宽用 non-scaling-stroke 保持不变。

export interface ChartPoint {
  x: number
  y: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

// 单调三次插值（Fritsch–Carlson）：曲线平滑且不会冲出相邻两点之间的范围（不出现负数或高于峰值的假象）。
function tangents(points: ChartPoint[]): number[] {
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index] as ChartPoint
    return (point.y - previous.y) / (point.x - previous.x)
  })
  return points.map((_point, index) => {
    if (index === 0) {
      return slopes[0] ?? 0
    }
    if (index === points.length - 1) {
      return slopes[index - 1] ?? 0
    }
    const before = slopes[index - 1] ?? 0
    const after = slopes[index] ?? 0
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after)
  })
}

export function smoothLinePath(points: ChartPoint[]): string {
  const first = points[0]
  if (first === undefined) {
    return ''
  }
  const slope = tangents(points)
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index] as ChartPoint
    const third = (point.x - previous.x) / 3
    const c1 = { x: previous.x + third, y: previous.y + (slope[index] ?? 0) * third }
    const c2 = { x: point.x - third, y: point.y - (slope[index + 1] ?? 0) * third }
    return `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(point.x)} ${round(point.y)}`
  })
  return [`M${round(first.x)} ${round(first.y)}`, ...segments].join(' ')
}

// 折线下方的面积：沿折线走完后落到横轴（y = 100）再闭合。
export function areaPath(points: ChartPoint[]): string {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) {
    return ''
  }
  return `${smoothLinePath(points)} L${round(last.x)} 100 L${round(first.x)} 100 Z`
}

// 环形图：周长为 100 的圆（r = 100 / 2π），每段用 stroke-dasharray 画出自己的份额，按顺序首尾相接、从 12 点方向开始。
export const DONUT_RADIUS = 15.9155

export interface DonutSegment<T> {
  item: T
  dashArray: string
  dashOffset: number
}

export function donutSegments<T>(items: T[], count: (item: T) => number): DonutSegment<T>[] {
  const total = items.reduce((sum, item) => sum + count(item), 0)
  if (total === 0) {
    return []
  }
  let start = 0
  return items.filter((item) => count(item) > 0).map((item) => {
    const share = (count(item) / total) * 100
    const segment = { item, dashArray: `${round(share)} ${round(100 - share)}`, dashOffset: round(25 - start) }
    start += share
    return segment
  })
}
