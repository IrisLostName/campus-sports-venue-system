// FE-5 P3：场地列表、改名、改状态、设定数量、场馆简介；改状态与设定数量走共用的影响检查流程（P4）。
import { describe, expect, it } from 'vitest'

import { openResourcesPage } from './resourcesHarness'

describe('P3 场地列表', () => {
  it('列出全部场地（含已停用），按接口顺序；状态按钮按 docs/03 第 6 节状态图', async () => {
    const { ctx, page } = await openResourcesPage()
    await ctx.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    await ctx.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    await page.resources.load()

    expect(page.resources.rows.value.map((row) => [row.name, row.typeLabel, row.statusLabel, row.tone, row.actions.map((action) => action.label)])).toEqual([
      ['网球场1', '球场', '开放', 'success', ['设为维护', '停用']],
      ['网球场2', '球场', '开放', 'success', ['设为维护', '停用']],
      ['网球场3', '球场', '维护中', 'danger', ['恢复开放', '停用']],
      ['网球场4', '球场', '已停用', 'neutral', ['重新启用']],
    ])
  })

  it('越权场馆：FORBIDDEN_SCOPE 文案', async () => {
    const { page } = await openResourcesPage('admin_tennis', 2)

    expect(page.error.value).toBe('无权操作该场馆')
  })
})

describe('P3 改名', () => {
  it('名称为空不发请求；改名直接提交（不做影响检查），列表更新', async () => {
    const { page, calls } = await openResourcesPage()
    page.resources.openRename(1)
    page.resources.patchRename({ name: '  ' })
    await page.resources.confirmRename()
    expect(page.resources.rename.value?.error).toBe('请填写场地名称')

    page.resources.patchRename({ name: ' 中心场 ', error: null })
    await page.resources.confirmRename()

    expect(calls.find((call) => call.method === 'adminUpdateResource')?.args).toEqual([1, { name: '中心场' }])
    expect(page.resources.rename.value).toBeNull()
    expect(page.notice.value).toBe('场地已改名')
    expect(page.resources.rows.value[0]?.name).toBe('中心场')
    expect(page.flow.dialog.value).toBeNull()
  })
})

describe('P3 改状态（P4 流程）', () => {
  it('网球场1 设为维护：预检列出 1 个受影响预约；选保留后提交，列表与场馆资料刷新', async () => {
    const { page, calls, reloads } = await openResourcesPage()
    await page.resources.changeStatus(1, 'MAINTENANCE')

    expect(page.flow.dialog.value?.title).toBe('将 网球场1 设为维护')
    expect(page.flow.dialog.value?.impact.affectedCount).toBe(1)
    page.flow.choose('KEEP')
    await page.flow.confirm()

    const sent = calls.filter((call) => call.method === 'adminUpdateResource').map((call) => call.args)
    expect(sent).toEqual([
      [1, { operationalStatus: 'MAINTENANCE', dryRun: true }],
      [1, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'KEEP' }],
    ])
    expect(page.resources.rows.value[0]?.statusLabel).toBe('维护中')
    expect(reloads.length).toBe(1)
    expect(page.notice.value).toBe('已保存')
  })

  it('选取消并填原因：受影响预约被取消，提示数量', async () => {
    const { ctx, page } = await openResourcesPage()
    await page.resources.changeStatus(1, 'DISABLED')
    page.flow.choose('CANCEL')
    page.flow.setReason('场地拆除')
    await page.flow.confirm()

    expect(page.notice.value).toBe('已保存，并取消 1 个受影响预约')
    const list = await ctx.api.adminListReservations({ venueId: 1, keyword: '张三' })
    expect(list.items[0]).toMatchObject({ status: 'ADMIN_CANCELLED', adminNote: '场地拆除' })
  })

  it('没有受影响预约：普通确认，请求不带 onExistingReservations', async () => {
    const { page, calls } = await openResourcesPage()
    await page.resources.changeStatus(4, 'MAINTENANCE')
    expect(page.flow.dialog.value?.impact.affectedCount).toBe(0)
    await page.flow.confirm()

    expect(calls.filter((call) => call.method === 'adminUpdateResource').map((call) => call.args[1])).toEqual([
      { operationalStatus: 'MAINTENANCE', dryRun: true }, { operationalStatus: 'MAINTENANCE' },
    ])
  })

  it('状态图里没有的转换（停用 → 维护）不会发起流程', async () => {
    const { ctx, page, calls } = await openResourcesPage()
    await ctx.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    await page.resources.load()
    await page.resources.changeStatus(4, 'MAINTENANCE')

    expect(page.flow.dialog.value).toBeNull()
    expect(calls.some((call) => call.method === 'adminUpdateResource')).toBe(false)
  })
})

describe('P3 设定场地数量', () => {
  it('输入必须是 0–50 的整数', async () => {
    const { page, calls } = await openResourcesPage()
    for (const bad of ['', 'abc', '-1', '51', '2.5']) {
      page.resources.form.count = bad
      await page.resources.submitCount()
      expect(page.error.value).toBe('场地数量须为 0 到 50 的整数')
    }

    expect(calls.some((call) => call.method === 'adminSetResourceCount')).toBe(false)
  })

  it('表单默认是当前数量；缩小到 3：预检无受影响预约，确认后停用编号最大的场地，数量同步', async () => {
    const { page, calls } = await openResourcesPage()
    expect(page.resources.form.count).toBe('4')
    page.resources.form.count = '3'
    await page.resources.submitCount()
    expect(page.flow.dialog.value?.title).toBe('将场地数量设为 3')
    expect(page.flow.dialog.value?.impact.affectedCount).toBe(0)
    await page.flow.confirm()

    expect(calls.filter((call) => call.method === 'adminSetResourceCount').map((call) => call.args)).toEqual([
      [1, { count: 3, dryRun: true }], [1, { count: 3 }],
    ])
    expect(page.resources.rows.value.map((row) => row.statusLabel)).toEqual(['开放', '开放', '开放', '已停用'])
    expect(page.resources.form.count).toBe('3')
  })

  it('增大到 5：新增“网球场5”；名称前缀与类型留空由后端沿用', async () => {
    const { page } = await openResourcesPage()
    page.resources.form.count = '5'
    await page.resources.submitCount()
    await page.flow.confirm()

    expect(page.resources.rows.value.map((row) => row.name)).toEqual(['网球场1', '网球场2', '网球场3', '网球场4', '网球场5'])
  })

  it('设为 0：两个预约受影响，选取消后全部场地停用', async () => {
    const { page } = await openResourcesPage()
    page.resources.form.count = '0'
    await page.resources.submitCount()
    expect(page.flow.dialog.value?.impact.affectedCount).toBe(2)
    page.flow.choose('CANCEL')
    page.flow.setReason('整体改造')
    await page.flow.confirm()

    expect(page.notice.value).toBe('已保存，并取消 2 个受影响预约')
    expect(new Set(page.resources.rows.value.map((row) => row.statusLabel))).toEqual(new Set(['已停用']))
  })
})

describe('P3 场馆还没有场地时（演示主线：新场馆设定数量）', () => {
  it('名称前缀与场地类型必填；填写后按它们生成场地', async () => {
    const { page, calls } = await openResourcesPage('sysadmin', 1, async (api) => (
      await api.adminCreateVenue({ name: '篮球馆', venueType: 'BASKETBALL' })
    ).id)
    page.resources.form.count = '8'
    await page.resources.submitCount()
    expect(page.error.value).toBe('该场馆还没有场地，请填写名称前缀和场地类型')
    expect(calls.some((call) => call.method === 'adminSetResourceCount')).toBe(false)

    page.resources.form.namePrefix = ' 篮球场 '
    page.resources.form.resourceType = 'OTHER'
    await page.resources.submitCount()
    await page.flow.confirm()

    expect(calls.find((call) => call.method === 'adminSetResourceCount')?.args).toEqual([
      4, { count: 8, namePrefix: '篮球场', resourceType: 'OTHER', dryRun: true },
    ])
    expect(page.resources.rows.value.map((row) => row.name)).toEqual(Array.from({ length: 8 }, (_unused, index) => `篮球场${index + 1}`))
  })
})

describe('P3 场馆简介', () => {
  it('只提交 description，其他字段一个都不带；保存后场馆资料刷新', async () => {
    const { ctx, page, calls, reloads } = await openResourcesPage()
    page.profile.form.description = ' 室内网球馆，共 4 片场地 '
    await page.profile.save()

    expect(calls.find((call) => call.method === 'adminUpdateVenue')?.args).toEqual([1, { description: '室内网球馆，共 4 片场地' }])
    expect(page.notice.value).toBe('场馆简介已保存')
    expect(reloads.length).toBe(1)
    expect((await ctx.api.adminListVenues())[0]?.description).toBe('室内网球馆，共 4 片场地')
    expect(page.profile.form.description).toBe('室内网球馆，共 4 片场地')
  })
})
