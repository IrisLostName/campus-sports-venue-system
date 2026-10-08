// FE-5 S3：venueId 查询参数的解析。缺省、格式不对、不在授权范围时取第一个场馆。
import { describe, expect, it } from 'vitest'

import { parseVenueId, resolveVenueId } from '../../src/utils/venueSelection'

const POOL = [{ id: 2 }, { id: 3 }]

describe('S3 resolveVenueId', () => {
  it('查询参数在授权范围内：原样采用', () => {
    expect(resolveVenueId('3', POOL)).toBe(3)
  })

  it.each([undefined, null, '', 'abc', '1.5', '-2', ['x'], 7])('缺省或格式不对（%s）：取第一个场馆', (raw) => {
    expect(resolveVenueId(raw, POOL)).toBe(2)
  })

  it('不在授权范围（例如 1）：取第一个场馆', () => {
    expect(resolveVenueId('1', POOL)).toBe(2)
  })

  it('数组形式的查询参数取第一个值', () => {
    expect(resolveVenueId(['3', '2'], POOL)).toBe(3)
  })

  it('没有任何授权场馆：null', () => {
    expect(resolveVenueId('1', [])).toBeNull()
    expect(parseVenueId('12')).toBe(12)
  })
})
