// “我的”页的用户资料与报修展示口径（FE-4 M1、M3）：纯函数。
import { describe, expect, it } from 'vitest'

import type { RepairReport, UserProfile, UserType } from '../../src/api/types'
import { buildProfile, buildRepair, REPAIR_STATUS_LABELS, USER_TYPE_LABELS } from '../../src/utils/meDisplay'
import { loginAs } from '../reservations/harness'

const PROFILE: UserProfile = {
  id: 1, username: 'zhangsan', displayName: '张三', role: 'USER', userType: 'STUDENT', phone: null,
  status: 'ACTIVE', venueIds: null,
}

describe('M1 用户资料', () => {
  it('姓名、用户名、身份中文名；手机号为空显示“未填写”', () => {
    expect(buildProfile(PROFILE)).toEqual({
      displayName: '张三', username: 'zhangsan', userTypeText: '学生', phoneText: '未填写',
    })
  })

  it('手机号有值时原样显示；纯空白视为空', () => {
    expect(buildProfile({ ...PROFILE, phone: '13800000000' }).phoneText).toBe('13800000000')
    expect(buildProfile({ ...PROFILE, phone: '   ' }).phoneText).toBe('未填写')
    expect(buildProfile({ ...PROFILE, phone: '' }).phoneText).toBe('未填写')
  })

  it.each<[UserType, string]>([['STUDENT', '学生'], ['TEACHER', '教师'], ['OTHER', '其他']])('%s → %s', (userType, label) => {
    expect(USER_TYPE_LABELS[userType]).toBe(label)
    expect(buildProfile({ ...PROFILE, userType }).userTypeText).toBe(label)
  })

  it('来自登录用户（王五是教师），不需要另行请求', async () => {
    const ctx = await loginAs('wangwu', '/me')
    const user = ctx.h.auth.user
    if (user === null) {
      throw new Error('应已登录')
    }

    expect(buildProfile(user)).toEqual({ displayName: '王五', username: 'wangwu', userTypeText: '教师', phoneText: '未填写' })
  })
})

describe('M3 报修展示', () => {
  const REPORT: RepairReport = {
    id: 5, venueId: 1, venueName: '网球馆', resourceId: null, resourceName: null, reporterId: 1, reporterName: '张三',
    description: '球网损坏', status: 'SUBMITTED', resultNote: null,
    createdAt: '2026-10-12T09:00:00', updatedAt: '2026-10-12T09:00:00',
  }

  it('状态中文名', () => {
    expect(REPAIR_STATUS_LABELS).toEqual({ SUBMITTED: '已提交', IN_PROGRESS: '处理中', RESOLVED: '已解决' })
  })

  it('描述、场馆、状态与时间；resultNote 为空时不给', () => {
    expect(buildRepair(REPORT)).toEqual({
      id: 5, venueName: '网球馆', description: '球网损坏', statusLabel: '已提交', status: 'SUBMITTED',
      resultNote: null, createdText: '2026-10-12 09:00',
    })
  })

  it('已解决并有处理结果：给出 resultNote；纯空白视为空', () => {
    expect(buildRepair({ ...REPORT, status: 'RESOLVED', resultNote: '已更换球网' })).toMatchObject({
      statusLabel: '已解决', resultNote: '已更换球网',
    })
    expect(buildRepair({ ...REPORT, resultNote: '  ' }).resultNote).toBeNull()
  })
})
