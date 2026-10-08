// 场馆选择（FE-5 S3）：查询参数 venueId 缺省、格式不对或不在授权范围时取第一个场馆。
export function parseVenueId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null
  }
  return Number(value)
}

export function resolveVenueId(raw: unknown, venues: readonly { id: number }[]): number | null {
  const wanted = parseVenueId(raw)
  if (wanted !== null && venues.some((venue) => venue.id === wanted)) {
    return wanted
  }
  return venues[0]?.id ?? null
}
