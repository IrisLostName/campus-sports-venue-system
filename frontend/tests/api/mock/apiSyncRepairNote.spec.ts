// API-SYNC 台账 S-050、S-066（审计 F1）：报修处理的 resultNote 是否填写按 Java isBlank() 判断，与后端
// ResultNoteMatchesStatusValidator 一致——全角空格算空白，NBSP 不算；其余 resultNote 口径同 S-066。
import { describe, expect, it } from 'vitest'

import type { RepairReport } from '../../../src/api/types'
import { createHarness, expectApiError, type Harness } from '../support/harness'

const FULL_WIDTH_SPACE = String.fromCharCode(0x3000)
const NBSP = String.fromCharCode(0xa0)

// zhangsan 在网球馆提交一条报修，之后以 admin_tennis 登录。
async function withRepair(): Promise<{ h: Harness; repair: RepairReport }> {
  const h = createHarness()
  await h.loginAs('zhangsan')
  const repair = await h.api.createRepair({ venueId: 1, description: '球网破损' })
  await h.loginAs('admin_tennis')
  return { h, repair }
}

describe('S-050 / S-066 resultNote 的空白判定同 Java isBlank()', () => {
  it('RESOLVED + 全角空格 → VALIDATION_ERROR fields.resultNote，报修不变', async () => {
    const { h, repair } = await withRepair()
    await expectApiError(h.api.adminUpdateRepair(repair.id, { status: 'RESOLVED', resultNote: FULL_WIDTH_SPACE }),
      'VALIDATION_ERROR', { fields: { resultNote: '不能为空' } })
    expect((await h.api.adminListRepairs({})).items.find((item) => item.id === repair.id)?.status).toBe('SUBMITTED')
  })

  it('IN_PROGRESS + 全角空格 → VALIDATION_ERROR fields.resultNote', async () => {
    const { h, repair } = await withRepair()
    await expectApiError(h.api.adminUpdateRepair(repair.id, { status: 'IN_PROGRESS', resultNote: FULL_WIDTH_SPACE }),
      'VALIDATION_ERROR', { fields: { resultNote: '不能为空' } })
  })

  it('NBSP 不算空白：RESOLVED + NBSP 照常处理并原样保存', async () => {
    const { h, repair } = await withRepair()
    const updated = await h.api.adminUpdateRepair(repair.id, { status: 'RESOLVED', resultNote: NBSP })
    expect(updated).toMatchObject({ status: 'RESOLVED', resultNote: NBSP })
  })
})

describe('S-066 resultNote 的其余口径', () => {
  it('超过 500 个字符 → VALIDATION_ERROR fields.resultNote', async () => {
    const { h, repair } = await withRepair()
    await expectApiError(h.api.adminUpdateRepair(repair.id, { status: 'RESOLVED', resultNote: 'x'.repeat(501) }),
      'VALIDATION_ERROR', { fields: { resultNote: '长度不能超过 500' } })
  })

  it('IN_PROGRESS 不给 resultNote 时保留原值（新报修的原值为 null）', async () => {
    const { h, repair } = await withRepair()
    const updated = await h.api.adminUpdateRepair(repair.id, { status: 'IN_PROGRESS' })
    expect(updated).toMatchObject({ status: 'IN_PROGRESS', resultNote: null })
  })

  it('非法迁移 → INVALID_STATE，details.status 为当前状态', async () => {
    const { h, repair } = await withRepair()
    await h.api.adminUpdateRepair(repair.id, { status: 'RESOLVED', resultNote: '已更换球网' })
    await expectApiError(h.api.adminUpdateRepair(repair.id, { status: 'IN_PROGRESS' }), 'INVALID_STATE',
      { status: 'RESOLVED' })
  })
})
