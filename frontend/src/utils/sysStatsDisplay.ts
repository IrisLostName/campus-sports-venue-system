// 全局统计的展示口径（FE-6 G5；docs/12 第 5.10 节，docs/03 第 8 节）。只格式化接口返回的数字，不重新计算（FE-6 X6）。
import type { StatsOverview } from '../api/typesSection5'
import { formatRate } from './adminOverviewDisplay'

export interface ByVenueView {
  venueId: number
  venueName: string
  countText: string
  rateText: string
}

export function buildByVenue(stats: StatsOverview): ByVenueView[] {
  return stats.byVenue.map((item) => ({
    venueId: item.venueId,
    venueName: item.venueName,
    countText: String(item.reservationCount),
    rateText: formatRate(item.utilizationRate),
  }))
}
