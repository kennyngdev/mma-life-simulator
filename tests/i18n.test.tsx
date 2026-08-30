import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { I18nProvider, resolveInitialLocale, translationCatalogs, useI18n } from '../src/i18n'

describe('i18n runtime', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('keeps both catalogs in exact key parity', () => {
    expect(Object.keys(translationCatalogs.en).sort()).toEqual(Object.keys(translationCatalogs['zh-Hant']).sort())
  })

  it('uses query override before saved and browser preferences', () => {
    localStorage.setItem('cage-life:locale:v1', 'zh-Hant')
    expect(resolveInitialLocale('?lang=en', ['zh-TW'])).toBe('en')
    expect(resolveInitialLocale('', ['zh-TW'])).toBe('zh-Hant')
  })

  it('defaults Chinese browsers to Traditional Chinese and others to English', () => {
    expect(resolveInitialLocale('', ['zh-HK', 'en'])).toBe('zh-Hant')
    expect(resolveInitialLocale('', ['ja-JP', 'en-US'])).toBe('en')
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
