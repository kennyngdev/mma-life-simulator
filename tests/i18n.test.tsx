import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { FIGHT_INTENTS } from '../src/game/fight-content'
import { MOVE_LABELS_EN, TRAIT_PRESENTATION_EN } from '../src/game/presentation-localization'
import { TRAITS } from '../src/game/progression'
import { I18nProvider, resolveInitialLocale, translationCatalogs, useI18n } from '../src/i18n'

describe('i18n runtime', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('covers every static Traditional Chinese key and limits English-only entries to authored presentation prose', () => {
    const traditionalChineseKeys = Object.keys(translationCatalogs['zh-Hant']).sort()
    const traditionalChineseKeySet = new Set(traditionalChineseKeys)
    const englishKeys = Object.keys(translationCatalogs.en).sort()

    expect(traditionalChineseKeys.filter((key) => !(key in translationCatalogs.en))).toEqual([])

    const englishOnlyKeys = englishKeys.filter((key) => !traditionalChineseKeySet.has(key))
    expect(englishOnlyKeys.length).toBeGreaterThan(0)
    for (const key of englishOnlyKeys) {
      const translation = translationCatalogs.en[key]
      expect(key).toMatch(/^(payload|presentation)\./)
      expect(translation.trim(), key).not.toBe('')
      expect(translation, key).not.toBe(key)
      expect(translation, key).toMatch(/[A-Za-z]/)
      expect(translation, key).not.toMatch(/[\u3400-\u9fff]/)
    }
  })

  it('authors English presentation copy for every combat move and displayed trait', () => {
    expect(Object.keys(MOVE_LABELS_EN).sort()).toEqual(FIGHT_INTENTS.map((move) => move.id).sort())
    expect(Object.keys(TRAIT_PRESENTATION_EN).sort()).toEqual(TRAITS.map((trait) => trait.id).sort())

    for (const label of Object.values(MOVE_LABELS_EN)) {
      expect(label).toMatch(/[A-Za-z]/)
      expect(label).not.toMatch(/[\u3400-\u9fff]/u)
    }
    for (const copy of Object.values(TRAIT_PRESENTATION_EN)) {
      expect([copy.name, copy.description, copy.condition, copy.effect, copy.tradeoff ?? ''].join(' ')).not.toMatch(/[\u3400-\u9fff]/u)
    }
  })

  it('uses query override before saved and browser preferences', () => {
    localStorage.setItem('cage-life:locale:v1', 'zh-Hant')
    expect(resolveInitialLocale('?lang=en', ['zh-TW'])).toBe('en')
    expect(resolveInitialLocale('', ['zh-TW'])).toBe('zh-Hant')
  })

  it('defaults Chinese browsers to Traditional Chinese and others to English', () => {
    expect(resolveInitialLocale('', ['zh'])).toBe('zh-Hant')
    expect(resolveInitialLocale('', ['zh-HK', 'en'])).toBe('zh-Hant')
    expect(resolveInitialLocale('', ['zh-Hans-CN'])).toBe('zh-Hant')
    expect(resolveInitialLocale('', ['ja-JP', 'en-US'])).toBe('en')
    expect(resolveInitialLocale('', ['en-US'])).toBe('en')
  })

  it('falls back to Traditional Chinese when browser language is unavailable', () => {
    expect(resolveInitialLocale('', [])).toBe('zh-Hant')
    expect(resolveInitialLocale('', [''])).toBe('zh-Hant')
  })

  it('switches immediately, persists outside the career, and updates metadata', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>
    const { result } = renderHook(() => useI18n(), { wrapper })
    act(() => result.current.setLocale('en'))
    expect(result.current.t('start.begin')).toBe('Begin fighter career')
    expect(localStorage.getItem('cage-life:locale:v1')).toBe('en')
    expect(window.location.search).toBe('?lang=en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Cage Life — MMA Career Simulator')
  })

  it('replaces an explicit URL override when the player switches language', () => {
    window.history.replaceState({}, '', '/?lang=en')
    const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>
    const { result } = renderHook(() => useI18n(), { wrapper })
    act(() => result.current.setLocale('zh-Hant'))
    expect(result.current.locale).toBe('zh-Hant')
    expect(window.location.search).toBe('?lang=zh-Hant')
    expect(localStorage.getItem('cage-life:locale:v1')).toBe('zh-Hant')
  })
})
