// 报修处理的展示口径（FE-5 P7；docs/12 第 5.4 节）。按钮只依据 status：SUBMITTED → IN_PROGRESS → RESOLVED，可由 SUBMITTED 直接到 RESOLVED。
import type { RepairReport, RepairStatus } from '../api/types'
import { REPAIR_STATUS_LABELS } from './meDisplay'
import { formatTimestamp } from './reservationDisplay'
import { toneForRepairStatus, type Tone } from './statusTone'

export type RepairTarget = 'IN_PROGRESS' | 'RESOLVED'

export interface RepairStep {
  label: string
  target: RepairTarget
}

export function repairStepsFor(status: RepairStatus): RepairStep[] {
  switch (status) {
    case 'SUBMITTED':
      return [{ label: '开始处理', target: 'IN_PROGRESS' }, { label: '标记已解决', target: 'RESOLVED' }]
    case 'IN_PROGRESS':
      return [{ label: '标记已解决', target: 'RESOLVED' }]
    case 'RESOLVED':
      return []
  }
}

// docs/13：处理结果上限 500（FE-5 裁决 Q8）。
export const REPAIR_NOTE_MAX_LENGTH = 500
export const WHOLE_VENUE_PLACE = '整个场馆'
export const RESULT_REQUIRED_TEXT = '请填写处理结果'

export const REPAIR_FILTER_ITEMS = [
  { value: '', label: '全部' },
  { value: 'SUBMITTED', label: REPAIR_STATUS_LABELS.SUBMITTED },
  { value: 'IN_PROGRESS', label: REPAIR_STATUS_LABELS.IN_PROGRESS },
  { value: 'RESOLVED', label: REPAIR_STATUS_LABELS.RESOLVED },
]

export interface RepairRowView {
  id: number
  createdText: string
  place: string
  reporterName: string
  description: string
  status: RepairStatus
  statusLabel: string
  tone: Tone
  resultNote: string | null
  steps: RepairStep[]
}

// 行内按钮的可访问名称里指明“是哪一条报修”（FE-8 L11）：地点 报修人 提交时间。
export function repairName(row: Pick<RepairRowView, 'place' | 'reporterName' | 'createdText'>): string {
  return `${row.place} ${row.reporterName} ${row.createdText}`
}

export function buildRepairRow(report: RepairReport): RepairRowView {
  return {
    id: report.id,
    createdText: formatTimestamp(report.createdAt),
    place: report.resourceName ?? WHOLE_VENUE_PLACE,
    reporterName: report.reporterName,
    description: report.description,
    status: report.status,
    statusLabel: REPAIR_STATUS_LABELS[report.status],
    tone: toneForRepairStatus(report.status),
    resultNote: report.resultNote === null || report.resultNote.trim() === '' ? null : report.resultNote,
    steps: repairStepsFor(report.status),
  }
}
