let catalog: Record<string, string> = {}
const cjk = /[\u3400-\u9fff]/
const localizedPunctuation = /[。；，：「」、／｜]/
const cache = new Map<string, string>()
const manualOverrides: Record<string, string> = {
  '取得一筆地方贊助，但疲勞增加、備戰狀態下降。': 'Receive a local sponsorship, but gain fatigue and lose readiness.',
  '教練': 'Coach',
  '歷程': 'History',
  '歲': 'years old',
  '招式': 'move',
  '招': 'moves',
  '安排檢查與治療': 'Arrange an examination and treatment',
  '特質': 'trait',
  '備戰狀態': 'readiness',
  '情報': 'scouting',
  '回合': 'round',
  '主效': 'Main effect',
  '擊倒成立': 'Knockdown scored',
  '你減少主動交換，用步法和防守保存體力；{0}沒能有效切入，雙方仍在遠距對峙。': 'You reduce exchanges and use footwork and defense to preserve stamina; {0} cannot enter effectively, and the fight remains at range.',
}
const englishCorrections: Array<[RegExp, string]> = [
  [/Not Included in Alliance Ranking/gi, 'Outside league rankings'],
  [/\bAlliance\b/g, 'league'],
  [/\bembrace\b/gi, 'clinch'],
  [/Physical strength/gi, 'Stamina'],
  [/Technology XP/gi, 'Technical XP'],
  [/Behind-the-scenes control/gi, 'Back control'],
  [/Bare Rope Neck Choke(?: \(RNC\))?/gi, 'Rear-naked choke (RNC)'],
  [/Rear Naked Cross/gi, 'Back armbar'],
  [/Subjugation/gi, 'Submission'],
  [/SubmitEnd Stress/gi, 'submission finish pressure'],
  [/End window/gi, 'finish window'],
  [/End窗口/gi, 'finish window'],
  [/Offense\/Defense/gi, 'Exchange'],
  [/Close-fitting short knee/gi, 'Short clinch knee'],
  [/Remote success rate/gi, 'Range success'],
  [/\bRemote\b/g, 'Range'],
  [/\bIntelligence\b/g, 'Scouting'],
  [/Finishing stage/gi, 'Finishing phase'],
  [/Defensive Countermeasure/gi, 'Defensive response'],
  [/Boxer's condition/gi, 'Fighter status'],
  [/Land battle/gi, 'Ground game'],
  [/Throwing and Takedown/gi, 'Wrestling'],
  [/Balanced framework/gi, 'Balanced frame'],
  [/Competition weight class/gi, 'Weight class'],
  [/new features/gi, 'new traits'],
  [/Each has its gains and losses/gi, 'Contested'],
  [/mutually advantageous/gi, 'contested'],
  [/Expected slam/gi, 'Anticipated takedown'],
  [/Elbow narrowing/gi, 'Tight elbows'],
  [/Backed by a wire mesh/gi, 'Backed to the cage'],
  [/The same move has been viewed (\d+) times/gi, 'The same move has been seen $1 time(s)'],
]

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let templates: Array<{ regex: RegExp; within: RegExp; indexes: number[]; target: string }> = []
let fragments: Array<[string, string]> = []

function prepareCatalog() {
  templates = Object.entries(catalog).filter(([source]) => /\{\d+\}/.test(source)).map(([source, target]) => {
  const indexes = [...source.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1]))
  const parts = source.split(/\{\d+\}/).map(escapeRegex)
  return { regex: new RegExp(`^${parts.join('(.+?)')}$`, 'u'), within: new RegExp(parts.join('(.+?)'), 'gu'), indexes, target }
  })

  fragments = Object.entries(catalog)
    .filter(([source]) => !/\{\d+\}/.test(source) && source.length >= 2)
    .sort(([a], [b]) => b.length - a.length)
}

export async function loadLegacyEnglishCatalog(): Promise<void> {
  if (Object.keys(catalog).length) return
  catalog = { ...(await import('./legacy-en.generated.json')).default as Record<string, string>, ...manualOverrides }
  prepareCatalog()
}

function cleanResidualText(value: string, skip?: string): string {
  let translated = value
  for (let pass = 0; pass < 3; pass += 1) {
    const before = translated
    for (const template of templates) {
      template.within.lastIndex = 0
      translated = translated.replace(template.within, (...args: unknown[]) => {
        const captures = args.slice(1, template.indexes.length + 1) as string[]
        const values: Record<number, string> = {}
        template.indexes.forEach((index, capture) => { values[index] = captures[capture] ?? '' })
        return template.target.replace(/\{(\d+)\}/g, (_, index: string) => values[Number(index)] ?? '')
      })
    }
    for (const [fragment, replacement] of fragments) {
      if (fragment === skip || fragment === replacement || !translated.includes(fragment)) continue
      translated = translated.split(fragment).join(replacement)
    }
    if (translated === before) break
  }
  translated = translated
    .replaceAll('。', '. ')
    .replaceAll('；', '; ')
    .replaceAll('，', ', ')
    .replaceAll('：', ': ')
    .replaceAll('「', '“')
    .replaceAll('」', '”')
    .replaceAll('、', ', ')
    .replaceAll('／', ' / ')
    .replaceAll('｜', ' | ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\b(Trust)([+-])/g, '$1 $2')
    .replace(/(\d)(Year\b)/g, '$1 $2')
    .replace(/·(?=\S)/g, '· ')
  for (const [pattern, replacement] of englishCorrections) translated = translated.replace(pattern, replacement)
  for (const [source, replacement] of Object.entries(manualOverrides)) {
    if (source.length === 1) translated = translated.replaceAll(source, replacement)
  }
  // Pre-i18n saves can contain prose that no longer exists in the authored
  // catalog. Never leak an unreadable fragment into the English interface.
  translated = translated.replace(/[\u3400-\u9fff]+/gu, 'legacy career detail')
  return translated
}

function preserveSentenceBoundary(source: string, translated: string): string {
  return /[。！？]\s*$/.test(source) && !/\s$/.test(translated) ? `${translated} ` : translated
}

/** Compatibility renderer for prose-only saves and content awaiting semantic records. */
export function localizeLegacyText(source: string): string {
  if (!cjk.test(source) && !localizedPunctuation.test(source)) return source
  const cached = cache.get(source)
  if (cached) return cached
  const direct = catalog[source]
  if (direct) {
    const translated = preserveSentenceBoundary(source, cleanResidualText(direct, source))
    cache.set(source, translated)
    return translated
  }
  for (const template of templates) {
    const match = source.match(template.regex)
    if (!match) continue
    const values: Record<number, string> = {}
    template.indexes.forEach((index, capture) => { values[index] = match[capture + 1] })
    const translated = preserveSentenceBoundary(source, cleanResidualText(template.target.replace(/\{(\d+)\}/g, (_, index: string) => values[Number(index)] ?? '')))
    cache.set(source, translated)
    return translated
  }
  const translated = preserveSentenceBoundary(source, cleanResidualText(source))
  cache.set(source, translated)
  return translated
}

export function hasEnglishLegacyTranslation(source: string): boolean {
  return !cjk.test(localizeLegacyText(source))
}
