import { beforeAll, describe, expect, it } from 'vitest'
import { hasEnglishLegacyTranslation, loadLegacyEnglishCatalog, localizeLegacyText } from '../src/locales/legacy'
import generated from '../src/locales/legacy-en.generated.json'

describe('legacy English compatibility catalog', () => {
  beforeAll(async () => { await loadLegacyEnglishCatalog() })

  it.each([
    ['業餘聯盟', 'Amateur League'],
    ['沙田', 'Sha Tin'],
    ['謝晉希', 'Xie Jinxī'],
    ['取得 HK$ 730 地方贊助，但疲勞增加、備戰狀態下降。', 'Obtained HK$ 730 local sponsorship, but fatigue increased and battle readiness decreased.'],
  ])('localizes %s', (source, expected) => {
    expect(localizeLegacyText(source).trim()).toBe(expected)
    expect(hasEnglishLegacyTranslation(source)).toBe(true)
  })

  it('resolves runtime template values without changing their data', () => {
    const text = localizeLegacyText('18 歲 · 中量級 · 2-1-0')
    expect(text).not.toMatch(/[歲量級]/)
    expect(text).toContain('18')
    expect(text).toContain('2-1-0')
  })

  it('has an English result for every extracted source message', () => {
    const unresolved = Object.keys(generated).filter((source) => !hasEnglishLegacyTranslation(source))
    expect(unresolved).toEqual([])
  })
})
