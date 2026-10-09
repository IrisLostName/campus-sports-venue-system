// 场馆资料与开关的展示口径（FE-6 G1；docs/12 第 2、5.5 节，docs/13 venue 表）。
// 文档没有 VenueType 之外的中文名：BASKETBALL 篮球、OTHER 其他、场馆状态 开放 / 已关闭、开关文案 由 FE-6 施工拟定（FE-6 裁决 §5-4 已认可）。
import type { VenueStatus, VenueSummary, VenueType } from '../api/types'
import type { CreateVenueRequest, UpdateVenueRequest } from '../api/requests'

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  TENNIS: '网球',
  BADMINTON: '羽毛球',
  SWIMMING: '游泳',
  BASKETBALL: '篮球',
  OTHER: '其他',
}

export const VENUE_TYPE_OPTIONS = (Object.keys(VENUE_TYPE_LABELS) as VenueType[])
  .map((value) => ({ value, label: VENUE_TYPE_LABELS[value] }))

export const VENUE_STATUS_LABELS: Record<VenueStatus, string> = {
  OPEN: '开放',
  CLOSED: '已关闭',
}

export const BOOKING_SWITCH_LABEL = '对用户开放预约'
export const NAME_REQUIRED_TEXT = '请填写场馆名称'
export const TYPE_REQUIRED_TEXT = '请选择场馆类型'
export const NO_CHANGE_TEXT = '没有需要保存的修改'
export const PROFILE_SAVED_NOTICE = '场馆资料已保存'
export const REOPENED_NOTICE = '场馆已重新开放'

export function createdNotice(name: string): string {
  return `已新增场馆“${name}”。请到“场地与开放规则”设定场地数量和每周开放窗口。`
}

export function bookingNotice(name: string, enabled: boolean): string {
  return enabled ? `${name}已对用户开放预约` : `${name}已暂停对用户开放预约`
}

export interface VenueRowView {
  id: number
  name: string
  typeLabel: string
  locationText: string | null
  statusLabel: string
  open: boolean
  bookingEnabled: boolean
  resourceCount: number
}

export function buildVenueRow(venue: VenueSummary): VenueRowView {
  return {
    id: venue.id,
    name: venue.name,
    typeLabel: VENUE_TYPE_LABELS[venue.venueType],
    locationText: venue.location,
    statusLabel: VENUE_STATUS_LABELS[venue.operationalStatus],
    open: venue.operationalStatus === 'OPEN',
    bookingEnabled: venue.userBookingEnabled,
    resourceCount: venue.resourceCount,
  }
}

// 表单里的文本；venueType 为 '' 表示未选。
export interface VenueFormFields {
  name: string
  venueType: VenueType | ''
  location: string
  description: string
}

export type CheckedVenueForm = VenueFormFields & { venueType: VenueType }

export function emptyVenueForm(): VenueFormFields {
  return { name: '', venueType: '', location: '', description: '' }
}

export function venueFormProblem(fields: VenueFormFields): string | null {
  if (fields.name.trim() === '') {
    return NAME_REQUIRED_TEXT
  }
  return fields.venueType === '' ? TYPE_REQUIRED_TEXT : null
}

// 新建：空的可选字段不发送（docs/12 第 5.5 节：location?、description?）。调用前须先通过 venueFormProblem。
export function buildCreateVenueRequest(fields: CheckedVenueForm): CreateVenueRequest {
  const location = fields.location.trim()
  const description = fields.description.trim()
  return {
    name: fields.name.trim(),
    venueType: fields.venueType,
    ...(location === '' ? {} : { location }),
    ...(description === '' ? {} : { description }),
  }
}

// 编辑：只提交改动的字段（FE-6 裁决 §5-3）。null 的位置 / 简介视为空串，没动就不发送；
// 把非空内容清空时照实发送 ''，接口若拒绝，错误文案原样显示。
export function buildUpdateVenueRequest(original: VenueSummary, fields: CheckedVenueForm): UpdateVenueRequest {
  const name = fields.name.trim()
  const location = fields.location.trim()
  const description = fields.description.trim()
  return {
    ...(name === original.name ? {} : { name }),
    ...(fields.venueType === original.venueType ? {} : { venueType: fields.venueType }),
    ...(location === (original.location ?? '') ? {} : { location }),
    ...(description === (original.description ?? '') ? {} : { description }),
  }
}
