// 场馆选择（FE-5 S3）：查询参数 venueId 缺省、格式不对或不在授权范围时取第一个场馆。
export function parseVenueId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null
  }
  return Number(value)
}

// allowAll（FE-6 S4）：系统管理员端的“全部场馆”页面——查询参数缺省或无效时不取第一个场馆，而是不选（null）。
export function resolveVenueId(raw: unknown, venues: readonly { id: number }[], allowAll = false): number | null {
  const wanted = parseVenueId(raw)
  if (wanted !== null && venues.some((venue) => venue.id === wanted)) {
    return wanted
  }
  return allowAll ? null : (venues[0]?.id ?? null)
}
