// 场馆图片的静态文件约定（UI-3 裁决已定事项第 2 条、第 4 节第 6 条）：
//   frontend/public/media/venues/<venueId>/cover.jpg   封面
//   frontend/public/media/venues/<venueId>/logo.png    标志
// 图片由负责人在部署前放入，随前端打包；仓库里不放图片。不从 CDN 加载，不改数据库与接口。
// 缺图（404，或站点回退返回的不是图片）时由 VenueMedia 显示中性占位。

export type VenueMediaKind = 'cover' | 'logo'

const FILE_NAMES: Record<VenueMediaKind, string> = { cover: 'cover.jpg', logo: 'logo.png' }

export function venueMediaUrl(venueId: number, kind: VenueMediaKind, base: string = import.meta.env.BASE_URL): string {
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}media/venues/${venueId}/${FILE_NAMES[kind]}`
}

// 标志占位：场馆名的第一个字。
export function venueInitial(name: string): string {
  return Array.from(name.trim())[0] ?? ''
}
