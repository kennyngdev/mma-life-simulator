import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createIntl, createIntlCache, IntlProvider, type IntlShape } from 'react-intl'
import type { ReactNode } from 'react'

export const SUPPORTED_LOCALES = ['zh-Hant', 'en'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

const LOCALE_STORAGE_KEY = 'cage-life:locale:v1'

const zhHant = {
  'app.name': '拳途人生 Cage Life',
  'app.title': '拳途人生 Cage Life',
  'app.description': '拳途人生 Cage Life，一款 mobile-first MMA 生命模擬遊戲。',
  'common.continue': '繼續',
  'common.back': '返回',
  'common.confirm': '確認',
  'common.locked': '尚未解鎖',
  'common.mastered': '專家',
  'nav.history': '生涯歷程',
  'nav.status': '拳手狀態',
  'nav.insight': '技術領悟',
  'start.noSave': '尚未開始任何人生',
  'locale.label': '語言',
  'locale.zh-Hant': '繁體中文',
  'locale.en': 'English',
  'loading': '正在整理拳套與生涯紀錄……',
  'save.resetNotice': '戰鬥系統已全面更新，舊生涯無法安全轉換；生涯殿堂仍完整保留。',
  'save.resetError': '無法清除本機進度，請稍後再試。',
  'start.tagline': '沒有人能學會所有招式再走進鐵籠。\n一次次取捨，會決定你成為什麼樣的拳手。',
  'start.version': '遊戲版本 {version}',
  'start.installTitle': '以 App 模式踏進鐵籠',
  'start.installBody': '加入主畫面後，可全螢幕開啟《拳途人生》，進度仍會保留在這台裝置。',
  'start.installAction': '安裝 App',
  'start.installHelp': '請在瀏覽器選單選擇「安裝 App」或「加入主畫面」。',
  'start.fighterName': '拳手姓名（選填）',
  'start.fighterNamePlaceholder': '留空將隨機產生姓名',
  'start.latinName': '英文／羅馬字姓名（選填）',
  'start.latinNamePlaceholder': '英文介面優先顯示；留空則沿用原名',
  'start.region': '出身地',
  'start.motive': '為何而戰',
  'start.experience': '你的起點',
  'start.combatMode': '比賽操作',
  'start.modeLocked': '開始生涯後無法更改。',
  'start.seed': '世界 Seed',
  'start.seedRandomize': '重新產生 Seed',
  'start.seedAction': '換',
  'start.seedHelp': '遊戲版本、Seed 和選擇都相同，就會走出同一段人生。',
  'start.begin': '開始拳手生涯',
  'start.beginHelp': '開始後將揭曉武術背景與先天條件',
  'start.hall': '生涯殿堂 · {count}',
  'start.disclaimer': '聯盟與選手皆為虛構 · 採綜合格鬥統一規則 · 進度只存在本機',
  'experience.normie.name': '普通人',
  'experience.normie.description': '五項技能都是 Lv.0，從帶點荒謬的草根試煉開始。',
  'experience.hobbyist.name': '業餘愛好者',
  'experience.hobbyist.description': '帶著一項隨 Seed 揭曉的武術背景，從正式業餘賽起步。',
  'experience.semi-pro.name': '半職業選手',
  'experience.semi-pro.description': '已經有成形打法與較多招式，直接進入地區職業舞台。',
  'combat.manual.name': '戰術操作',
  'combat.manual.description': '每段攻防親自選招；適合想研究位置、招式與反制的玩家。',
  'combat.coach.name': '教練帶領',
  'combat.coach.description': '你決定每回合戰術，教練依你的招式與場上局勢自動指揮；終結與脫困仍由你親手完成。',
  'region.hong-kong.label': '香港',
  'region.hong-kong.circuit': '國際門戶',
  'region.hong-kong.description': '商業曝光多、外來拳手也多。地方收入較高，但醫療與生活成本同樣更高。',
  'region.hong-kong.mix': '約 50% 香港 · 25% 鄰近地區 · 25% 亞洲來客',
  'region.hong-kong.economy': '高收入／高成本',
  'region.taiwan.label': '台灣',
  'region.taiwan.circuit': '拳館網絡',
  'region.taiwan.description': '地方拳館彼此熟識，對手與人情會反覆出現在你的生涯裡。收入與成本最穩定。',
  'region.taiwan.mix': '約 65% 台灣 · 20% 鄰近地區 · 15% 亞洲來客',
  'region.taiwan.economy': '穩定收入／穩定成本',
  'region.mainland.label': '中國大陸',
  'region.mainland.circuit': '深度賽事',
  'region.mainland.description': '城市賽事與跨城集訓密集，地方競爭最深。收入較低，但治療與生活成本也較低。',
  'region.mainland.mix': '約 75% 中國大陸 · 15% 鄰近地區 · 10% 亞洲來客',
  'region.mainland.economy': '低收入／低成本',
  'motive.family.name': '為家人而戰',
  'motive.family.description': '你最在意的是收入和對家人的承諾，不是名氣。',
  'motive.prove.name': '證明自己',
  'motive.prove.description': '越是被看衰，你越想打一場讓人閉嘴的比賽。',
  'motive.honor.name': '守住拳館',
  'motive.honor.description': '教練、隊友和拳館的招牌，都比個人得失重要。',
  'motive.fame.name': '站上聚光燈',
  'motive.fame.description': '你想打出名堂，接下最受矚目的比賽。',
} as const

export type TranslationKey = keyof typeof zhHant

const en: Record<TranslationKey, string> = {
  'app.name': 'Cage Life',
  'app.title': 'Cage Life — MMA Career Simulator',
  'app.description': 'Cage Life is a mobile-first MMA career simulator from obscurity to retirement.',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.confirm': 'Confirm',
  'common.locked': 'Locked',
  'common.mastered': 'Expert',
  'nav.history': 'Career history',
  'nav.status': 'Fighter status',
  'nav.insight': 'Technical insight',
  'start.noSave': 'No career started yet',
  'locale.label': 'Language',
  'locale.zh-Hant': '繁體中文',
  'locale.en': 'English',
  'loading': 'Preparing the gloves and career records…',
  'save.resetNotice': 'The combat system has been rebuilt and this old career cannot be converted safely. Hall of Fame biographies remain available.',
  'save.resetError': 'Local progress could not be cleared. Please try again.',
  'start.tagline': 'No fighter learns every move before entering the cage.\nYour choices will define the fighter you become.',
  'start.version': 'Game version {version}',
  'start.installTitle': 'Step into the cage in app mode',
  'start.installBody': 'Add Cage Life to your home screen for a full-screen experience. Your progress stays on this device.',
  'start.installAction': 'Install app',
  'start.installHelp': 'Choose “Install app” or “Add to Home Screen” from your browser menu.',
  'start.fighterName': 'Fighter name (optional)',
  'start.fighterNamePlaceholder': 'Leave blank to generate a name',
  'start.latinName': 'English / romanized name (optional)',
  'start.latinNamePlaceholder': 'Preferred in English; original name used if blank',
  'start.region': 'Home region',
  'start.motive': 'Why do you fight?',
  'start.experience': 'Your starting point',
  'start.combatMode': 'Fight controls',
  'start.modeLocked': 'This cannot be changed after the career begins.',
  'start.seed': 'World seed',
  'start.seedRandomize': 'Generate a new seed',
  'start.seedAction': 'New',
  'start.seedHelp': 'The same game version, seed, and choices produce the same career.',
  'start.begin': 'Begin fighter career',
  'start.beginHelp': 'Reveal your martial arts background and natural attributes',
  'start.hall': 'Hall of Fame · {count}',
  'start.disclaimer': 'All leagues and fighters are fictional · Unified MMA rules · Progress is stored only on this device',
  'experience.normie.name': 'Complete beginner',
  'experience.normie.description': 'Begin with every skill at Lv.0 in a rough-and-ready grassroots trial.',
  'experience.hobbyist.name': 'Amateur hobbyist',
  'experience.hobbyist.description': 'Reveal a seeded martial arts background and begin in formal amateur competition.',
  'experience.semi-pro.name': 'Semi-pro fighter',
  'experience.semi-pro.description': 'Start with an established style and a larger move set on the regional pro circuit.',
  'combat.manual.name': 'Tactical control',
  'combat.manual.description': 'Choose every exchange yourself and study positions, moves, and counters.',
  'combat.coach.name': 'Coach-guided',
  'combat.coach.description': 'Choose each round plan while your coach calls legal moves. You still control finishes and escapes.',
  'region.hong-kong.label': 'Hong Kong',
  'region.hong-kong.circuit': 'International gateway',
  'region.hong-kong.description': 'More commercial exposure and visiting fighters, with higher local income as well as higher medical and living costs.',
  'region.hong-kong.mix': 'About 50% Hong Kong · 25% nearby regions · 25% Asian visitors',
  'region.hong-kong.economy': 'High income / high costs',
  'region.taiwan.label': 'Taiwan',
  'region.taiwan.circuit': 'Gym network',
  'region.taiwan.description': 'Local gyms know one another, so opponents and relationships recur throughout your career. Income and costs are the most stable.',
  'region.taiwan.mix': 'About 65% Taiwan · 20% nearby regions · 15% Asian visitors',
  'region.taiwan.economy': 'Stable income / stable costs',
  'region.mainland.label': 'Mainland China',
  'region.mainland.circuit': 'Deep regional circuit',
  'region.mainland.description': 'Dense city events and cross-city camps create the deepest local competition. Income is lower, but treatment and living costs are too.',
  'region.mainland.mix': 'About 75% mainland China · 15% nearby regions · 10% Asian visitors',
  'region.mainland.economy': 'Lower income / lower costs',
  'motive.family.name': 'Fight for family',
  'motive.family.description': 'Income and your promises to family matter more than fame.',
  'motive.prove.name': 'Prove yourself',
  'motive.prove.description': 'The more people doubt you, the more you want one performance that silences them.',
  'motive.honor.name': 'Defend the gym',
  'motive.honor.description': 'Your coach, teammates, and gym name matter more than personal glory.',
  'motive.fame.name': 'Chase the spotlight',
  'motive.fame.description': 'You want to make a name and take the fights everyone is watching.',
}

export const translationCatalogs: Record<Locale, Record<TranslationKey, string>> = { 'zh-Hant': zhHant, en }
const cache = createIntlCache()

function validLocale(value: string | null | undefined): value is Locale {
  return value === 'zh-Hant' || value === 'en'
}

export function resolveInitialLocale(locationSearch = window.location.search, browserLanguages = navigator.languages): Locale {
  const queryLocale = new URLSearchParams(locationSearch).get('lang')
  if (validLocale(queryLocale)) return queryLocale
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (validLocale(stored)) return stored
  return browserLanguages.some((language) => language.toLowerCase().startsWith('zh')) ? 'zh-Hant' : 'en'
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  intl: IntlShape
  t: (id: TranslationKey, values?: Record<string, string | number>) => string
}

const fallbackIntl = createIntl({ locale: 'zh-Hant', messages: zhHant }, cache)
const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-Hant', setLocale: () => undefined, intl: fallbackIntl,
  t: (id, values) => fallbackIntl.formatMessage({ id, defaultMessage: zhHant[id] }, values),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveInitialLocale())
  const intl = useMemo(() => createIntl({ locale, messages: translationCatalogs[locale] }, cache), [locale])
  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
    setLocaleState(next)
  }, [])
  const t = useCallback((id: TranslationKey, values?: Record<string, string | number>) => intl.formatMessage({ id, defaultMessage: zhHant[id] }, values), [intl])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('app.title')
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('app.description'))
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href', `/manifest.${locale}.webmanifest`)
  }, [locale, t])

  const value = useMemo(() => ({ locale, setLocale, intl, t }), [locale, setLocale, intl, t])
  return createElement(I18nContext.Provider, { value }, createElement(IntlProvider, { locale, messages: translationCatalogs[locale] }, children))
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
