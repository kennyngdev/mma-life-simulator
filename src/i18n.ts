const zhHant = {
  appName: '拳途人生',
  continue: '繼續',
  back: '返回',
  confirm: '確認',
  locked: '尚未解鎖',
  mastered: '專家',
  history: '生涯歷程',
  status: '拳手狀態',
  insight: '技術領悟',
  noSave: '尚未開始任何人生',
} as const

export type TranslationKey = keyof typeof zhHant

export function t(key: TranslationKey): string {
  return zhHant[key]
}
