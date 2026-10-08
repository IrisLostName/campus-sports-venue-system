// 造历史预约的测试夹具：在可预约范围内订下不同的时段并立即取消，得到 CANCELLED 的历史预约。
// 订一个取消一个，不会触到“同时持有 3 个”的上限；每天 8 个时段 × 6 天，最多造 48 条。
import type { ApiClient } from '../../src/api/client'

const DAY_STARTS = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30']
const DAYS = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']

export async function seedCancelledHistory(api: ApiClient, count: number): Promise<number[]> {
  const ids: number[] = []
  for (const serviceDate of DAYS) {
    for (const startTime of DAY_STARTS) {
      if (ids.length === count) {
        return ids
      }
      const created = await api.createReservation({ resourceId: 1, serviceDate, startTime })
      await api.cancelReservation(created.id, {})
      ids.push(created.id)
    }
  }
  if (ids.length < count) {
    throw new Error(`一次最多只能造 ${DAYS.length * DAY_STARTS.length} 条取消的历史预约`)
  }
  return ids
}
