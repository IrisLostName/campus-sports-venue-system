// “我的”页的展示口径（FE-4 规划裁决 M1、M3）：用户资料与报修。
import type { RepairReport, RepairStatus, UserProfile, UserType } from '../api/types'
import { formatTimestamp } from './reservationDisplay'

export const NOT_PROVIDED_TEXT = '未填写'

// 报修描述的长度上限，对应 docs/13 的 description VARCHAR(500)。
export const REPAIR_DESCRIPTION_MAX_LENGTH = 500

// M1：userType 中文名。
export const USER_TYPE_LABELS: Record<UserType, string> = {
  STUDENT: '学生',
  TEACHER: '教师',
  OTHER: '其他',
}

// M3：报修状态中文名。
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  SUBMITTED: '已提交',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
}

export interface ProfileView {
  displayName: string
  username: string
  userTypeText: string
  phoneText: string
}

function nonBlank(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

// M1：phone 为空（null 或纯空白）显示“未填写”。
export function buildProfile(user: UserProfile): ProfileView {
  return {
    displayName: user.displayName,
    username: user.username,
    userTypeText: USER_TYPE_LABELS[user.userType],
    phoneText: nonBlank(user.phone) ?? NOT_PROVIDED_TEXT,
  }
}

export interface RepairView {
  id: number
  venueName: string
  description: string
  statusLabel: string
  status: RepairStatus
  resultNote: string | null      // 非空时显示
  createdText: string
}

export function buildRepair(report: RepairReport): RepairView {
  return {
    id: report.id,
    venueName: report.venueName,
    description: report.description,
    statusLabel: REPAIR_STATUS_LABELS[report.status],
    status: report.status,
    resultNote: nonBlank(report.resultNote),
    createdText: formatTimestamp(report.createdAt),
  }
}
