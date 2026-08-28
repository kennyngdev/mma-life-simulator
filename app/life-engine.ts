import {
  createBattle,
  reduceBattle,
  type BattleActionDefinition,
  type BattleActor,
  type BattleObjectiveState,
  type BattleRules,
  type BattleState,
} from './battle';

export type SectId = 'huashan' | 'shaolin' | 'wudang' | 'beggar' | 'emei' | 'tang';
export type InsightId = `${SectId}-${1 | 2 | 3}-${'a' | 'b'}`;
export type DifficultyId = 'relaxed' | 'standard' | 'hard';
export type RarityId = 'common' | 'rare' | 'legendary';
export type IdentityKind = 'origin' | 'trait' | 'burden';
export type LifePhase = '少年' | '入門' | '闖蕩' | '成名' | '晚年';
export type LifeScreen = 'start' | 'reveal' | 'sect' | 'life' | 'prebattle' | 'battle' | 'result' | 'admission' | 'insight' | 'talent-shop' | 'ending';
export type StatKey = 'strength' | 'agility' | 'constitution' | 'wisdom' | 'will' | 'luck';
export type PathId = 'duelist' | 'contractor' | 'protector';
export type PathScores = Record<PathId, number>;
export type DeathId = `death:${string}`;
export type TalentId = string;

export type Sect = {
  id: SectId;
  name: string;
  subtitle: string;
  color: string;
  icon: string;
  style: string;
  quip: string;
  moves: Array<{ id: string; name: string; description: string; qiCost: number; action: BattleActionDefinition }>;
};

export type DeathDefinition = { id: DeathId; title: string; cause: string; hint: string; epitaph: string };
export type EncounterObjective = {
  type: 'eliminate' | 'leader' | 'progress' | 'survive' | 'peaceful';
  label: string;
  description: string;
  failure: string;
  required: number;
  actionLabel?: string;
  protect?: boolean;
};
export type BattlePreparation = {
  guard?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  enemyAttack?: number;
  objectiveEase?: number;
  removeEnemy?: boolean;
  inviteFriend?: boolean;
};
export type LifeChoice = {
  id: string;
  path: PathId;
  title: string;
  description: string;
  preview: string;
  moneyCost: number;
  growthStat: StatKey;
  objective: EncounterObjective;
  preparation: BattlePreparation;
  resolution: 'battle' | 'peaceful';
  turningPoint: string;
};
export type LifeEvent = {
  id: string;
  turn: number;
  path: PathId | 'shared';
  title: string;
  place: string;
  lead: string;
  conflict: string;
  weather: '晴' | '雨' | '風';
  enemyName: string;
  enemyRole: 'warrior' | 'assassin' | 'tank';
  enemyCount: number;
  death: DeathDefinition;
  choices: LifeChoice[];
};
export type PreparationFeedback = { headline: string; bridge: string; effect: string; fightReason: string; actionLabel: string };
export type BattleMeta = {
  eventId: string;
  choiceId: string;
  growthStat: StatKey;
  preparation: BattlePreparation;
  feedback: PreparationFeedback;
  startedHp: number;
  initialEnemyCount: number;
};
export type BattleResultCard = {
  kind: 'battle' | 'peaceful';
  won: boolean;
  grade: 'C' | 'B' | 'A' | 'S';
  score: number;
  moments: string[];
  line: string;
  rewards: string[];
  death?: DeathDefinition;
  awardedDeathPoint?: boolean;
};
export type TalentDefinition = {
  id: TalentId;
  name: string;
  rarity: RarityId;
  benefit: string;
  drawback: string;
  modifiers: Partial<{ hpMultiplier: number; qiMultiplier: number; attackMultiplier: number; speedMultiplier: number; hp: number; qi: number; attack: number; defense: number; speed: number; recovery: number; money: number }>;
};
export type MetaProgress = { version: 3; deathPoints: number; discoveredDeathIds: DeathId[]; purchasedTalents: TalentId[]; disabledTalents: TalentId[] };
export const emptyMetaProgress: MetaProgress = { version: 3, deathPoints: 0, discoveredDeathIds: [], purchasedTalents: [], disabledTalents: [] };

export type LifeRun = {
  version: 15;
  seed: string;
  name: string;
  origin: string;
  trait: TalentId;
  burden: string;
  difficulty: DifficultyId;
  legacyTalents: TalentId[];
  aspiredSectId: SectId | null;
  sectId: SectId | null;
  age: number;
  year: number;
  turn: number;
  stats: Record<StatKey, number>;
  potential: Record<StatKey, number>;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  money: number;
  pathScores: PathScores;
  lastChosenPath: PathId | null;
  turningPoints: string[];
  consumedTurningPoints: string[];
  proficiency: number;
  insights: InsightId[];
  reputation: number;
  bond: number;
  friendName: string;
  rivalName: string;
  friendship: number;
  rivalry: number;
  injury: number;
  dead: boolean;
  deathReason: string | null;
  moments: string[];
  chronicle: string[];
  battle: BattleState | null;
  battleMeta: BattleMeta | null;
  result: BattleResultCard | null;
};

const hash = (input: string) => {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) { value ^= input.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
};
const pick = <T,>(items: readonly T[], seed: string) => items[hash(seed) % items.length];
const range = (seed: string, min: number, max: number) => min + (hash(seed) % (max - min + 1));
const uniqueSorted = <T extends string>(values: readonly T[]) => [...new Set(values)].sort() as T[];
const strike = (id: string, label: string, target: BattleActionDefinition['target'], qiCost: number, effects: BattleActionDefinition['effects']): BattleActionDefinition => ({ id, label, target, qiCost, effects });

export const statNames: Record<StatKey, string> = { strength: '力道', agility: '身法', constitution: '根骨', wisdom: '悟性', will: '心性', luck: '福緣' };
export const pathNames: Record<PathId, string> = { duelist: '問劍', contractor: '行契', protector: '守人' };
export const phases: Array<{ name: LifePhase; start: number; end: number; age: number; year: number; premise: string }> = [
  { name: '少年', start: 0, end: 2, age: 12, year: 1590, premise: '先在江湖活下來，才輪得到門派挑你。' },
  { name: '入門', start: 3, end: 6, age: 18, year: 1596, premise: '進門不代表被接納，只代表開始排班。' },
  { name: '闖蕩', start: 7, end: 10, age: 28, year: 1606, premise: '路越遠，承諾越難假裝沒看見。' },
  { name: '成名', start: 11, end: 13, age: 40, year: 1618, premise: '名聲開始替你做決定。' },
  { name: '晚年', start: 14, end: 15, age: 54, year: 1632, premise: '最後留下的，是你反覆選過的那種人。' },
];
export const difficulties = [
  { id: 'relaxed' as const, name: '散步江湖', description: '敵人較寬容，死亡仍會算數。', enemyScale: -1 },
  { id: 'standard' as const, name: '正經闖蕩', description: '每一場真打都可能是最後一場。', enemyScale: 0 },
  { id: 'hard' as const, name: '名宿的麻煩', description: '敵人更兇，但不會因前世天賦而偷漲。', enemyScale: 1 },
];

const sectBlueprints: Array<[SectId, string, string, string, string, [string, string, string, string]]> = [
  ['huashan', '華山', '劍路越長，理由越少', '#e7a85f', '劍', ['起手式', '破雲一線', '收劍調息', '回風守勢']],
  ['shaolin', '少林', '把麻煩站到沒力', '#e8c669', '拳', ['伏虎掌', '金鐘撞', '坐忘', '不動明王']],
  ['wudang', '武當', '借力可以，借錢不行', '#7ab8c5', '太', ['雲手', '借力打力', '太和吐納', '圓轉如意']],
  ['beggar', '丐幫', '人脈很廣，住處很窄', '#92b86d', '棍', ['打狗棒影', '百家一棍', '一口濁酒', '巷口步']],
  ['emei', '峨眉', '手很穩，耐心有限', '#c88cad', '針', ['拂塵點穴', '月影封脈', '靜心敷藥', '清規攔人']],
  ['tang', '唐門', '不近人情，近距離很危險', '#a681d1', '鏢', ['細雨針', '暴雨梨花', '以毒養氣', '迷煙退場']],
];

function makeSect([id, name, subtitle, color, icon, labels]: typeof sectBlueprints[number]): Sect {
  const status = id === 'tang' || id === 'emei' ? 'toxin' : 'sword-form';
  return {
    id, name, subtitle, color, icon,
    style: id === 'shaolin' ? '護體與反震' : id === 'wudang' ? '化勁與反擊' : id === 'tang' ? '毒性與延遲' : '進攻、調息與守勢',
    quip: `${name}的規矩很多，待遇寫得很小。`,
    moves: [
      { id: `${id}-attack`, name: labels[0], description: '穩定進招，留下可利用的狀態。', qiCost: 0, action: strike(`${id}-attack`, labels[0], 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.04 }, { type: 'apply-status', id: status, stacks: 1, recipient: id === 'tang' || id === 'emei' ? 'target' : 'actor' }]) },
      { id: `${id}-power`, name: labels[1], description: '花內力改變戰鬥節奏。', qiCost: 12, action: strike(`${id}-power`, labels[1], 'selected-enemy', 12, id === 'tang' ? [{ type: 'consume-status-damage', id: 'toxin', damagePerStack: 17, delayPerStack: 8, statusOwner: 'target' }, { type: 'damage', multiplier: 1.18 }] : [{ type: 'damage', multiplier: 1.42 }, { type: 'expose-next-hit', percent: .2, recipient: 'target' }]) },
      { id: `${id}-recover`, name: labels[2], description: '回復氣血與內力，重新安排節奏。', qiCost: 0, action: strike(`${id}-recover`, labels[2], 'self', 0, [{ type: 'heal', amount: 14, recipient: 'actor' }, { type: 'restore-qi', amount: 10, recipient: 'actor' }]) },
      { id: `${id}-defend`, name: labels[3], description: '建立護體並改變下一次受擊。', qiCost: 7, action: strike(`${id}-defend`, labels[3], 'self', 7, [{ type: 'guard', amount: 14, recipient: 'actor' }, { type: 'reduce-next-hit', percent: .4, recipient: 'actor' }]) },
    ],
  };
}
export const sects = sectBlueprints.map(makeSect);
export const noviceStyle: Sect = {
  id: 'huashan', name: '未入門', subtitle: '先活過考核', color: '#b8aa8d', icon: '初', style: '人人都會的三個基本動作。', quip: '你挑了門派，門派還沒挑你。',
  moves: [
    { id: 'novice-punch', name: '亂拳直進', description: '選定敵人，普通攻擊。', qiCost: 0, action: strike('novice-punch', '亂拳直進', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1 }]) },
    { id: 'novice-cover', name: '護住要害', description: '護體 +12，下一擊少受 25%。', qiCost: 6, action: strike('novice-cover', '護住要害', 'self', 6, [{ type: 'guard', amount: 12, recipient: 'actor' }, { type: 'reduce-next-hit', percent: .25, recipient: 'actor' }]) },
    { id: 'novice-breathe', name: '喘勻這口氣', description: '氣血 +10、內力 +10。', qiCost: 0, action: strike('novice-breathe', '喘勻這口氣', 'self', 0, [{ type: 'heal', amount: 10, recipient: 'actor' }, { type: 'restore-qi', amount: 10, recipient: 'actor' }]) },
  ],
};

export const talentDefinitions: TalentDefinition[] = [
  { id: 'thick-skin', name: '臉皮很厚', rarity: 'common', benefit: '開場護體 +8。', drawback: '名聲獲得 −1。', modifiers: { defense: 2 } },
  { id: 'rain-hands', name: '雨天手穩', rarity: 'common', benefit: '身法 +2。', drawback: '最大內力 −4。', modifiers: { speed: 2, qi: -4 } },
  { id: 'route-memory', name: '記路很牢', rarity: 'common', benefit: '初始銀兩 +4。', drawback: '最大氣血 −4。', modifiers: { money: 4, hp: -4 } },
  { id: 'silver-guard', name: '銀票護心', rarity: 'rare', benefit: '銀兩可替你擋住一半傷害。', drawback: '每擋 2 傷害花 1 銀。', modifiers: { money: 6 } },
  { id: 'pain-generator', name: '痛處發電', rarity: 'rare', benefit: '受傷時回復相當於傷害 75% 的內力。', drawback: '最大氣血 −12%。', modifiers: { hpMultiplier: .88 } },
  { id: 'all-hands-overtime', name: '全員加班', rarity: 'rare', benefit: '友方治療與護體翻倍。', drawback: '你自己的回復效率 −15%。', modifiers: { recovery: -.15 } },
  { id: 'no-overtime-death', name: '拒絕加班死', rarity: 'legendary', benefit: '每戰一次，致命傷改為 1 氣血並獲得護體。', drawback: '速度 −18%。', modifiers: { speedMultiplier: .82 } },
  { id: 'hundred-meridians', name: '百脈俱通', rarity: 'legendary', benefit: '最大內力 +35%。', drawback: '防禦 −5。', modifiers: { qiMultiplier: 1.35, defense: -5 } },
  { id: 'backwater', name: '背水才會贏', rarity: 'legendary', benefit: '攻擊 +28%。', drawback: '最大氣血 −22%。', modifiers: { attackMultiplier: 1.28, hpMultiplier: .78 } },
];
export const talentPrice = (rarity: RarityId) => rarity === 'common' ? 1 : rarity === 'rare' ? 3 : 6;
export const talentFor = (id: TalentId) => talentDefinitions.find((talent) => talent.id === id);

const legacyNameMap = new Map(talentDefinitions.map((talent) => [talent.name, talent.id]));
export function parseMetaProgress(raw: string | null): MetaProgress {
  if (!raw) return structuredClone(emptyMetaProgress);
  try {
    const value = JSON.parse(raw) as Partial<MetaProgress> & { discoveredTraits?: string[] };
    const migrated = (value.discoveredTraits ?? []).map((name) => legacyNameMap.get(name) ?? name).filter((id) => talentFor(id));
    const purchasedTalents = uniqueSorted([...(value.purchasedTalents ?? []).filter((id) => talentFor(id)), ...migrated]);
    return {
      version: 3,
      deathPoints: Math.max(0, Math.floor(value.deathPoints ?? 0)),
      discoveredDeathIds: uniqueSorted((value.discoveredDeathIds ?? []).filter((id): id is DeathId => typeof id === 'string' && id.startsWith('death:'))),
      purchasedTalents,
      disabledTalents: uniqueSorted((value.disabledTalents ?? []).filter((id) => purchasedTalents.includes(id))),
    };
  } catch { return structuredClone(emptyMetaProgress); }
}
export function recordDeath(meta: MetaProgress, deathId: DeathId) {
  if (meta.discoveredDeathIds.includes(deathId)) return { meta, awarded: false };
  return { meta: { ...meta, deathPoints: meta.deathPoints + 1, discoveredDeathIds: uniqueSorted([...meta.discoveredDeathIds, deathId]) }, awarded: true };
}
export function purchaseTalent(meta: MetaProgress, talentId: TalentId) {
  const talent = talentFor(talentId);
  if (!talent) return { meta, ok: false, reason: '找不到這項天賦。' };
  if (meta.purchasedTalents.includes(talentId)) return { meta, ok: false, reason: '這項天賦已經屬於你。' };
  const price = talentPrice(talent.rarity);
  if (meta.deathPoints < price) return { meta, ok: false, reason: `還差 ${price - meta.deathPoints} 點死亡點數。` };
  return { meta: { ...meta, deathPoints: meta.deathPoints - price, purchasedTalents: uniqueSorted([...meta.purchasedTalents, talentId]) }, ok: true, reason: '已購買並設為繼承；投胎前可以停用。' };
}

export function activeLegacyTalents(meta: MetaProgress) {
  return meta.purchasedTalents.filter((id) => !meta.disabledTalents.includes(id));
}

export function toggleLegacyTalent(meta: MetaProgress, talentId: TalentId): MetaProgress {
  if (!meta.purchasedTalents.includes(talentId)) return meta;
  const disabledTalents = meta.disabledTalents.includes(talentId)
    ? meta.disabledTalents.filter((id) => id !== talentId)
    : uniqueSorted([...meta.disabledTalents, talentId]);
  return { ...meta, disabledTalents };
}

export function composeLegacyStats(activeIds: readonly TalentId[]) {
  const active = uniqueSorted(activeIds).map(talentFor).filter((talent): talent is TalentDefinition => Boolean(talent));
  const base = { hp: 100, qi: 50, attack: 16, defense: 7, speed: 16, recovery: .6, money: 12 };
  const multiplied = active.reduce((value, talent) => ({
    ...value,
    hp: value.hp * (talent.modifiers.hpMultiplier ?? 1),
    qi: value.qi * (talent.modifiers.qiMultiplier ?? 1),
    attack: value.attack * (talent.modifiers.attackMultiplier ?? 1),
    speed: value.speed * (talent.modifiers.speedMultiplier ?? 1),
  }), base);
  const added = active.reduce((value, talent) => ({
    hp: value.hp + (talent.modifiers.hp ?? 0), qi: value.qi + (talent.modifiers.qi ?? 0), attack: value.attack + (talent.modifiers.attack ?? 0),
    defense: value.defense + (talent.modifiers.defense ?? 0), speed: value.speed + (talent.modifiers.speed ?? 0),
    recovery: value.recovery + (talent.modifiers.recovery ?? 0), money: value.money + (talent.modifiers.money ?? 0),
  }), multiplied);
  return {
    hp: Math.max(35, Math.round(added.hp)), qi: Math.max(20, Math.round(added.qi)), attack: Math.max(5, Math.round(added.attack)),
    defense: Math.max(0, Math.round(added.defense)), speed: Math.max(5, Math.round(added.speed)),
    recovery: Number(Math.min(.85, Math.max(.4, added.recovery)).toFixed(4)), money: Math.max(0, Math.round(added.money)),
  };
}

export const origins = ['藥鋪學徒', '鏢局雜役', '沒落軍戶', '寺外棄童', '商隊小孩', '縣城學徒'] as const;
export const burdens = ['家裡欠了錢', '有人等你回家', '師父欠你一句道歉', '你其實很怕打架', '一封信一直沒寄', '大家以為你很有錢'] as const;
const friends = ['阿棠', '石見山', '柳小七', '顧晚舟', '沈二娘', '唐十三'];
const rivals = ['范少白', '段鐵嘴', '莫問天', '金如意', '霍三娘', '葉無聲'];

export function identityRarity(kind: IdentityKind, value: string): RarityId {
  if (kind === 'trait') return talentFor(value)?.rarity ?? 'common';
  return hash(`${kind}:${value}`) % 10 === 0 ? 'legendary' : hash(`${kind}:${value}`) % 3 === 0 ? 'rare' : 'common';
}
export function identityDetail(kind: IdentityKind, value: string) {
  if (kind === 'trait') { const talent = talentFor(value); return talent ? `${talent.benefit} 代價：${talent.drawback}` : value; }
  return kind === 'origin' ? `${value}教會你：江湖的第一課通常沒有師父。` : `${value}；這件事會在你最忙的時候回來。`;
}

export function newLife(name: string, seed: string, difficulty: DifficultyId, purchasedTalents: readonly TalentId[] = [], enabledLegacyTalents: readonly TalentId[] = purchasedTalents): LifeRun {
  const purchased = uniqueSorted(purchasedTalents.filter((id) => talentFor(id)));
  const legacyTalents = uniqueSorted(enabledLegacyTalents.filter((id) => purchased.includes(id)));
  const available = talentDefinitions.filter((talent) => !purchased.includes(talent.id));
  const trait = pick(available.length ? available : talentDefinitions, `${seed}:current-talent`).id;
  const active = uniqueSorted([...legacyTalents, trait]);
  const build = composeLegacyStats(active);
  const stats: Record<StatKey, number> = { strength: range(`${seed}:str`, 5, 8), agility: range(`${seed}:agi`, 5, 8), constitution: range(`${seed}:con`, 5, 8), wisdom: range(`${seed}:wis`, 5, 8), will: range(`${seed}:wil`, 5, 8), luck: range(`${seed}:luk`, 5, 8) };
  return {
    version: 15, seed, name: name.trim() || '無名', origin: pick(origins, `${seed}:origin`), trait, burden: pick(burdens, `${seed}:burden`), difficulty,
    legacyTalents, aspiredSectId: null, sectId: null, age: 12, year: 1590, turn: 0, stats, potential: { ...stats }, hp: build.hp, maxHp: build.hp, qi: build.qi, maxQi: build.qi,
    money: build.money, pathScores: { duelist: 0, contractor: 0, protector: 0 }, lastChosenPath: null, turningPoints: [], consumedTurningPoints: [], proficiency: 0, insights: [], reputation: 0, bond: 0,
    friendName: pick(friends, `${seed}:friend`), rivalName: pick(rivals, `${seed}:rival`), friendship: 0, rivalry: 0, injury: 0, dead: false, deathReason: null,
    moments: [], chronicle: [], battle: null, battleMeta: null, result: null,
  };
}

export const sectFor = (id: SectId | null | undefined) => sects.find((sect) => sect.id === id) ?? noviceStyle;
export const hasTalent = (run: LifeRun, id: TalentId) => run.trait === id || run.legacyTalents.includes(id);
export const needsSectChoice = (run: LifeRun) => run.turn >= 3 && !run.aspiredSectId && !run.sectId && !run.dead;
export function chooseAspiredSect(run: LifeRun, sectId: SectId): LifeRun {
  if (!needsSectChoice(run)) return run;
  const sect = sectFor(sectId);
  return { ...run, aspiredSectId: sectId, chronicle: [...run.chronicle, `${run.year}年：你想拜入${sect.name}。想是一回事，山門還沒點頭。`] };
}

type Beat = { title: string; place: string; lead: string; enemy: string; role?: LifeEvent['enemyRole']; count?: number; death: string; epitaph: string };
const duelistBeats: Beat[] = [
  { title: '木劍寫下的名字', place: '山門外坪', lead: '一把木劍、一列候補者，只有最後站著的人會被記名。', enemy: '持簿師兄', death: '木劍考核超出章程', epitaph: '你的名字終於進了名冊，在「耗材」那欄。' },
  { title: '眾目下的一劍', place: '演武坪', lead: '同門把你的沉默當成怯意，圍觀者已經押了銀子。', enemy: '好勝同門', death: '公開比武無人喊停', epitaph: '裁判很公正：等你不動了才宣布結果。' },
  { title: '榜首沒有座位', place: '戒律堂', lead: '你的名次太高，剛好擋住某位長老的侄子。', enemy: '戒律執事', role: 'tank', death: '名次調整採用物理手段', epitaph: '榜單恢復了秩序，你也恢復成了過去式。' },
  { title: '師兄借你的劍', place: '藏劍廊', lead: '借劍的人要拿你的兵器去完成自己的恩怨。', enemy: '借劍師兄', death: '借物契約沒有歸還條款', epitaph: '劍還了，劍鞘裡順便附上你的訃聞。' },
  { title: '山門前的挑戰帖', place: '石階', lead: '外派高手點名要你出來，門內的人把門關得很快。', enemy: '踢館客', death: '門派聲譽由個人承保', epitaph: '山門保住了面子，你則保不住裡子。' },
  { title: '三郡第一的價碼', place: '春風樓', lead: '富商願替你辦擂台，只要求每一劍都像商品。', enemy: '商會劍客', death: '贊助條款要求打滿全場', epitaph: '掌聲很久，主要因為退票窗口提早關了。' },
  { title: '雨夜連環帖', place: '驛道', lead: '七張戰帖在雨裡黏成一張，對方決定一次結清。', enemy: '連環挑戰者', count: 2, death: '戰帖合併但傷害未合併', epitaph: '郵差省了路，你省了餘生。' },
  { title: '被捧高的名號', place: '郡城擂台', lead: '人們先替你取了天下無雙，再等你證明他們沒有誇大。', enemy: '無雙候選', death: '稱號驗收未通過', epitaph: '牌匾做得比棺材早，尺寸倒是都合。' },
  { title: '舊敵的新東家', place: '鹽運碼頭', lead: '舊敵身後站著新金主，舊帳忽然有了利息。', enemy: '受聘宿敵', death: '私人恩怨完成公司化', epitaph: '他領了尾款，你領了全劇終。' },
  { title: '名劍只認勝者', place: '鑄劍莊', lead: '莊主把名劍擺在中間，失敗者連醫藥費都沒有。', enemy: '守劍人', role: 'tank', death: '產品試用不含人身保固', epitaph: '劍找到主人，主人沒找到脈搏。' },
  { title: '宗師席上的空位', place: '武林大會', lead: '空位只有一張，想坐的人卻帶了整隊見證。', enemy: '候席宗師', count: 2, death: '席位競爭缺乏安全規範', epitaph: '椅子最後空著，因為大家忙著寫悼詞。' },
  { title: '替名號還債', place: '祖師祠', lead: '你的名號被人借去欺壓百姓，現在受害者來討說法。', enemy: '冒名門客', death: '品牌授權管理失敗', epitaph: '你用命證明那不是你，公關上算成功。' },
  { title: '傳人的第一課', place: '後山竹林', lead: '你選中的傳人先問：若打不贏，名聲還算數嗎？', enemy: '求證傳人', death: '教學示範採用實戰規格', epitaph: '學生學會了最重要的一課：別站你那邊。' },
  { title: '封劍宴的加場', place: '舊擂台', lead: '你來封劍，賓客卻眾籌了一場最後挑戰。', enemy: '末席挑戰者', death: '退休申請遭群眾否決', epitaph: '封劍成功，連人一起封了。' },
  { title: '天下仍欠一劍', place: '雪峰', lead: '最後的對手帶著你一生留下的每個問題登頂。', enemy: '終生對手', role: 'tank', death: '最後挑戰沒有第二回合', epitaph: '你終於天下無敵，因為天下沒人再需要打你。' },
];

const contractorBeats: Beat[] = [
  { title: '第一趟鏢不包飯', place: '南城貨棧', lead: '貨主只付半價，卻要求你把完整風險扛走。', enemy: '截貨頭目', death: '低價承攬高風險鏢務', epitaph: '貨物準時到，你則永久離線。' },
  { title: '門派米袋少了三成', place: '山門庫房', lead: '帳簿寫滿，米缸卻空；管庫的人要你簽收。', enemy: '管庫執事', death: '替缺貨簽下全額收據', epitaph: '帳終於平了，你也躺平了。' },
  { title: '工錢要靠比武領', place: '外院', lead: '執事說贏了才算完成工作，輸了則算自願幫忙。', enemy: '欠薪教習', death: '薪資爭議轉為兵器仲裁', epitaph: '你的工錢保住了，歸家屬代領。' },
  { title: '師門債券到期', place: '錢莊後巷', lead: '掌門借的錢，債主決定找最能打的弟子收。', enemy: '錢莊打手', count: 2, death: '門派負債由弟子肉身擔保', epitaph: '利息沒有上限，你的年限有。' },
  { title: '藥材車的雙重貨主', place: '青石渡', lead: '兩份契約都說這車歸自己，兩邊都帶了刀。', enemy: '第二貨主', death: '一車兩賣引發現場驗貨', epitaph: '藥材救了很多人，只差你。' },
  { title: '護送名醫的附加條款', place: '瘴林', lead: '名醫臨時追加病人，路線和風險一起翻倍。', enemy: '採藥寨主', death: '附加工作未附加預算', epitaph: '名醫替你把脈後，第一次沒有開方。' },
  { title: '鏢路聯盟的入會費', place: '三岔驛', lead: '同行邀你結盟，費用是替他們清掉眼前的麻煩。', enemy: '封路寨主', role: 'tank', death: '會員資格採一次性繳命', epitaph: '你的會員卡永久有效，持卡人除外。' },
  { title: '危險客戶要保密', place: '夜船', lead: '客戶不肯說貨物內容，追兵卻知道得很清楚。', enemy: '滅口使者', count: 2, death: '保密條款只約束承辦人', epitaph: '秘密保住了，因為你再也不能說。' },
  { title: '全郡最大的賠單', place: '鏢局大堂', lead: '失貨不是你的錯，但你的名字寫在最後一格。', enemy: '索賠代表', death: '責任欄填得比事實快', epitaph: '賠償談妥了：你賠一生，他們償一口氣。' },
  { title: '替敵人送贖金', place: '亂石谷', lead: '這單能救人，也能讓兩個仇家都認為你背叛。', enemy: '疑心僱主', death: '中立承辦被雙方視為敵對', epitaph: '你公平地得罪了每一邊。' },
  { title: '總鏢頭的空章', place: '總局帳房', lead: '一枚空白印章能救急，也能把所有責任蓋到你身上。', enemy: '奪章副手', death: '空白授權被填入死期', epitaph: '印章還在，能負責的人少了一位。' },
  { title: '名聲折成了銀票', place: '票號', lead: '票號要你用名聲擔保一條即將崩掉的商路。', enemy: '催兌掌櫃', death: '信用過度槓桿', epitaph: '你的名聲兌現了，兌成人情事故。' },
  { title: '接班人的第一張單', place: '新鏢局', lead: '接班人接了便宜大單，現在希望你補上差額和性命。', enemy: '試局劫匪', death: '新人報價由前任承擔', epitaph: '他學會了成本，你成了案例。' },
  { title: '最後一紙生死約', place: '邊關驛站', lead: '你本想收山，舊客卻拿出當年沒有劃掉的一條。', enemy: '追約騎手', count: 2, death: '合約自動續期至來世', epitaph: '你履約到底，真的到了底。' },
  { title: '所有欠條一起上門', place: '故城長街', lead: '你救過的局、借過的錢、延過的期，在同一天結算。', enemy: '總帳代理', role: 'tank', death: '累積負債集中清算', epitaph: '帳本終於合上，夾住了你的一生。' },
];

const protectorBeats: Beat[] = [
  { title: '先送信，還是先救人', place: '河堤巷', lead: '信件關乎入門推薦，巷口的人卻正在搬離洪水。', enemy: '攔路水匪', death: '救援路線遭人為封鎖', epitaph: '推薦信沒濕，你倒是徹底涼了。' },
  { title: '新弟子的夜班', place: '外院柴房', lead: '師兄把危險差事全塞給最小的弟子，還稱作磨練。', enemy: '值夜師兄', death: '制度性霸凌升級為實戰', epitaph: '排班表改了，因為少了一個能代班的人。' },
  { title: '戒尺落向誰', place: '講武堂', lead: '犯錯的是權貴子弟，挨罰的卻是替他收拾的孩子。', enemy: '戒律教習', role: 'tank', death: '代罰制度遭當場質疑', epitaph: '戒尺證明人人平等，只是你比較先。' },
  { title: '被逐者的包袱', place: '下山道', lead: '被逐同門帶著傷與秘密，追來的人只要你別多事。', enemy: '追令弟子', death: '協助離職者遭前單位追責', epitaph: '離職手續辦完了，你成了附件。' },
  { title: '小鎮不在門派地圖上', place: '烏瓦鎮', lead: '山賊每月來收錢，門派說那裡不在管轄內。', enemy: '收保寨主', death: '非轄區居民自行求生', epitaph: '地圖沒有這個鎮，墓碑倒標得很準。' },
  { title: '難民營的最後一鍋粥', place: '北郊營地', lead: '粥只夠一晚，糧商卻帶人來封鍋抵債。', enemy: '封糧管事', count: 2, death: '救濟糧被依法扣押', epitaph: '公文完整，晚飯和你都不完整。' },
  { title: '守橋的人沒有援軍', place: '白石橋', lead: '撤離隊伍還在橋上，援軍的批文卻卡在兩郡之間。', enemy: '破橋先鋒', count: 2, death: '跨區援助等待蓋章', epitaph: '章到了，橋沒了，你也剛好不必簽收。' },
  { title: '病村的封鎖線', place: '柳葉村', lead: '官差要封村省事，村民需要的是藥和出口。', enemy: '封村都頭', death: '防疫措施省略救治', epitaph: '封鎖非常成功，連你的未來都沒出去。' },
  { title: '孩子們認得你的名字', place: '避難學堂', lead: '追兵要求交出一名證人，滿屋孩子都看著你。', enemy: '追證殺手', count: 2, death: '證人保護預算為零', epitaph: '孩子記住了你，官府記成了無名氏。' },
  { title: '城牆只修了正面', place: '邊城西門', lead: '官員把預算花在能被看見的牆，敵人從後巷進來。', enemy: '入城頭目', role: 'tank', death: '形象工程缺乏背面', epitaph: '正面很好看，尤其在你的葬禮畫裡。' },
  { title: '眾人推來的牌匾', place: '義莊前院', lead: '百姓要你接下護民盟主，這個稱號附帶所有人的危險。', enemy: '拆盟使者', death: '公共職位沒有職災保險', epitaph: '牌匾掛得很高，正好看不見你倒下。' },
  { title: '救一城還是救一人', place: '決水閘', lead: '開閘能保城，卻會淹掉你曾答應守住的那戶人家。', enemy: '奪閘官兵', count: 2, death: '公共決策缺乏撤離方案', epitaph: '會議最後一致通過：你已無法反對。' },
  { title: '保護成了一套規矩', place: '護民公所', lead: '你訂的規矩被下屬拿來拒絕真正需要幫助的人。', enemy: '僵化執事', death: '善意完成流程化反噬', epitaph: '制度繼續運作，只是不再包括你。' },
  { title: '那些被你留下的人', place: '舊難民營', lead: '當年的人回來幫忙，也把你沒守住的名字帶了回來。', enemy: '尋仇殘黨', count: 2, death: '舊案重啟缺少護衛編制', epitaph: '大家都回來了，只差你回去。' },
  { title: '最後一盞巷燈', place: '故里長巷', lead: '你守過的人已能自守，今晚卻仍有人來熄掉最後一盞燈。', enemy: '熄燈人', role: 'tank', death: '社區照明遭武力停辦', epitaph: '燈後來又點上了，省得大家摸黑祭你。' },
];

const sharedBeat: Beat = { title: '江湖先問你站哪邊', place: '青石路口', lead: '木劍場、急送貨、淹水巷同時喊人。你只能先往一邊走。', enemy: '路口惡客', death: '人生方向遭路霸提前結案', epitaph: '你選了方向，方向沒選擇避開你。' };
const beatSets: Record<PathId, Beat[]> = { duelist: duelistBeats, contractor: contractorBeats, protector: protectorBeats };
const pathWeather: Record<PathId, LifeEvent['weather']> = { duelist: '風', contractor: '雨', protector: '晴' };

function objectiveFor(path: PathId, turn: number, affordable: boolean): EncounterObjective {
  if (path === 'duelist') return { type: turn % 3 === 0 ? 'eliminate' : 'leader', label: turn % 3 === 0 ? '擊退全場' : '取下主事者', description: turn % 3 === 0 ? '擊倒所有敵人。' : '擊倒有名的首領，其餘人便會撤退。', failure: '你倒下便立刻死亡。', required: 1 };
  if (path === 'contractor' && affordable && turn % 4 === 1) return { type: 'peaceful', label: '買斷風險', description: '花銀兩請知情人打開安全路線，無需交戰。', failure: '已和平解決。', required: 0 };
  if (path === 'contractor') return { type: 'progress', label: '完成交付', description: '用回合推進明確工作，同時撐住追兵。', failure: '錯過期限或倒下便死亡。', required: 3, actionLabel: '推進交付' };
  return turn % 2 === 0
    ? { type: 'survive', label: '撐到眾人撤離', description: '承受指定次數的敵方行動。', failure: '你或受保護的人倒下便死亡。', required: 5, protect: true }
    : { type: 'progress', label: '組織撤離', description: '花回合完成撤離步驟。', failure: '期限前未完成，或受保護的人倒下便死亡。', required: 3, actionLabel: '護送一批人', protect: true };
}

function choicesFor(eventId: string, title: string, turn: number, opening: boolean): LifeChoice[] {
  const methods: Record<PathId, Omit<LifeChoice, 'id' | 'path' | 'turningPoint' | 'objective' | 'resolution'>> = {
    duelist: { title: `當眾接下「${title}」`, description: '把問題變成有名有姓的勝負；首領倒下，局面就會散。', preview: `${opening ? '+2' : '+1'} 問劍；名聲與宿敵關係上升。`, moneyCost: 0, growthStat: 'agility', preparation: { attack: 2 } },
    contractor: { title: `先算清「${title}」的代價`, description: '買情報、談路線、把工作拆成能完成的步驟。', preview: `${opening ? '+2' : '+1'} 行契；完成後領 6 銀工錢。`, moneyCost: turn % 4 === 1 ? 8 : 2, growthStat: 'wisdom', preparation: { objectiveEase: 1, removeEnemy: turn > 6 } },
    protector: { title: `先把「${title}」裡的人帶走`, description: '召集幫手並守住撤離節點；受保護者也會成為真實敗因。', preview: `${opening ? '+2' : '+1'} 守人；人情與同伴關係上升。`, moneyCost: 0, growthStat: 'will', preparation: { guard: 10, inviteFriend: turn > 4 } },
  };
  return (Object.keys(methods) as PathId[]).map((path) => {
    const method = methods[path];
    const objective = objectiveFor(path, turn, path === 'contractor');
    return { ...method, id: `${eventId}:${path}`, path, objective, resolution: objective.type === 'peaceful' ? 'peaceful' : 'battle', turningPoint: `${eventId}:${path}` };
  });
}

function eventFromBeat(beat: Beat, turn: number, path: PathId | 'shared'): LifeEvent {
  const id = path === 'shared' ? 'crossroads-01' : `${path}-${String(turn + 1).padStart(2, '0')}`;
  return {
    id, turn, path, title: beat.title, place: beat.place, lead: beat.lead, conflict: '這次的選法會改變目標規則，也會留下之後結算的人情與責任。',
    weather: path === 'shared' ? '晴' : pathWeather[path], enemyName: beat.enemy, enemyRole: beat.role ?? 'warrior', enemyCount: beat.count ?? 1,
    death: { id: `death:${id}`, title: beat.death, cause: `${beat.death}。你未能完成「${beat.title}」的目標，傷勢沒有留下第二次機會。`, hint: '下次先看勝利與失敗條件；用銀兩降低步驟、先處理首領，或把回合留給撤離。', epitaph: beat.epitaph },
    choices: choicesFor(id, beat.title, turn, path === 'shared'),
  };
}

export const authoredEvents: LifeEvent[] = [
  eventFromBeat(sharedBeat, 0, 'shared'),
  ...(['duelist', 'contractor', 'protector'] as PathId[]).flatMap((path) => beatSets[path].map((beat, index) => eventFromBeat(beat, index + 1, path))),
];
export const allDeathDefinitions = authoredEvents.map((event) => event.death);
export const campaignEventCount = authoredEvents.length;

export function dominantPath(pathScores: PathScores, lastChosenPath: PathId | null): PathId {
  const maximum = Math.max(...Object.values(pathScores));
  const tied = (Object.keys(pathScores) as PathId[]).filter((path) => pathScores[path] === maximum);
  return lastChosenPath && tied.includes(lastChosenPath) ? lastChosenPath : tied[0];
}
export function eventFor(run: LifeRun): LifeEvent {
  if (run.turn === 0) return authoredEvents[0];
  const path = dominantPath(run.pathScores, run.lastChosenPath);
  const event = authoredEvents.find((item) => item.path === path && item.turn === run.turn) ?? authoredEvents[0];
  const previousPath = run.turningPoints.at(-1)?.split(':').at(-1) as PathId | undefined;
  return previousPath ? { ...event, lead: `${event.lead} 上一回你選了${pathNames[previousPath]}，因此這次有人照那種做法來找你。` } : event;
}
export const deathFor = (run: LifeRun) => eventFor(run).death;
export const choiceAvailable = (run: LifeRun, choice: LifeChoice) => run.money >= choice.moneyCost;
export const choiceCommitmentFor = (_run: LifeRun, choice: LifeChoice) => choice.moneyCost ? `銀兩 −${choice.moneyCost}` : '不花銀兩';
export const choiceRewardFor = (_run: LifeRun, choice: LifeChoice) => choice.preview;
export const choiceFailureFor = (_run: LifeRun, choice: LifeChoice) => choice.objective.failure;

function activeTalentIds(run: LifeRun) { return uniqueSorted([...run.legacyTalents, run.trait]); }
function buildFor(run: LifeRun) { return composeLegacyStats(activeTalentIds(run)); }

function playerActor(run: LifeRun, prep: BattlePreparation): BattleActor {
  const build = buildFor(run);
  return { id: 'player', name: run.name, role: 'player', side: 'ally', hp: run.hp, maxHp: run.maxHp, qi: run.qi, maxQi: run.maxQi, attack: build.attack + Math.floor(run.stats.strength / 3) + (prep.attack ?? 0), defense: build.defense + Math.floor(run.stats.constitution / 4) + (prep.defense ?? 0), guard: (prep.guard ?? 0) + (hasTalent(run, 'thick-skin') ? 8 : 0), progress: 0, baseSpeed: build.speed + Math.floor(run.stats.agility / 3) + (prep.speed ?? 0), speed: 1, actionsTaken: 0, statuses: {} };
}
function enemyActors(run: LifeRun, event: LifeEvent, prep: BattlePreparation): BattleActor[] {
  const difficulty = difficulties.find((item) => item.id === run.difficulty)?.enemyScale ?? 0;
  const count = Math.max(1, event.enemyCount - (prep.removeEnemy ? 1 : 0));
  return Array.from({ length: count }, (_, index) => ({ id: `enemy-${index + 1}`, name: index ? `${event.enemyName}手下${index}` : event.enemyName, role: event.enemyRole, side: 'enemy' as const, hp: 46 + run.turn * 4 + difficulty * 9 + (event.enemyRole === 'tank' ? 18 : 0), maxHp: 46 + run.turn * 4 + difficulty * 9 + (event.enemyRole === 'tank' ? 18 : 0), qi: 24, maxQi: 36, attack: 11 + Math.floor(run.turn * .7) + difficulty * 2 + (prep.enemyAttack ?? 0), defense: 4 + Math.floor(run.turn / 5), guard: 0, progress: 0, baseSpeed: event.enemyRole === 'assassin' ? 19 : event.enemyRole === 'tank' ? 11 : 15, speed: 1, actionsTaken: 0, actionIds: ['enemy-strike', 'enemy-rest'], statuses: {} }));
}
function wardActor(run: LifeRun): BattleActor {
  return { id: 'ward', name: '受你保護的人', role: 'healer', side: 'ally', hp: 42 + run.turn * 2, maxHp: 42 + run.turn * 2, qi: 20, maxQi: 20, attack: 5, defense: 3, guard: 0, progress: 0, baseSpeed: 10, speed: 1, actionsTaken: 0, actionIds: ['ward-help'], statuses: {} };
}
function friendActor(run: LifeRun): BattleActor {
  return { id: 'friend', name: run.friendName, role: 'healer', side: 'ally', hp: 56, maxHp: 56, qi: 28, maxQi: 28, attack: 8, defense: 5, guard: 0, progress: 0, baseSpeed: 13, speed: 1, actionsTaken: 0, actionIds: ['friend-help'], statuses: {} };
}

export function rulesFor(style: Sect): BattleRules {
  const actions = Object.fromEntries(style.moves.map((move) => [move.id, move.action]));
  actions['enemy-strike'] = strike('enemy-strike', '逼命一擊', 'random-foe', 6, [{ type: 'damage', multiplier: 1.05 }]);
  actions['enemy-rest'] = strike('enemy-rest', '回氣', 'self', 0, [{ type: 'restore-qi', amount: 12, recipient: 'actor' }, { type: 'guard', amount: 4, recipient: 'actor' }]);
  actions['ward-help'] = strike('ward-help', '幫忙包紮', 'weakest-ally', 0, [{ type: 'heal', amount: 6, recipient: 'target' }]);
  actions['friend-help'] = strike('friend-help', '搭一把手', 'weakest-ally', 0, [{ type: 'heal', amount: 9, recipient: 'target' }, { type: 'guard', amount: 5, recipient: 'target' }]);
  return {
    actions,
    passives: {},
    speedModifiers: [],
    damageModifiers: [],
  };
}

export type InsightDefinition = { id: InsightId; tier: 1 | 2 | 3; sectId: SectId; name: string; description: string; moveId: string };
export const insightDefinitions: InsightDefinition[] = sects.flatMap((sect) => ([1, 2, 3] as const).flatMap((tier) => [
  { id: `${sect.id}-${tier}-a` as InsightId, tier, sectId: sect.id, name: tier === 1 ? '逼出破綻' : tier === 2 ? '守中帶攻' : '一招開路', description: tier === 1 ? '基本攻擊令目標下一擊多受 25%。' : tier === 2 ? '守勢同時準備反擊。' : '強攻改打最弱敵人，能先清掉阻礙。', moveId: tier === 1 ? `${sect.id}-attack` : tier === 2 ? `${sect.id}-defend` : `${sect.id}-power` },
  { id: `${sect.id}-${tier}-b` as InsightId, tier, sectId: sect.id, name: tier === 1 ? '吐納成環' : tier === 2 ? '後發先至' : '熟悉公事', description: tier === 1 ? '調息額外獲得護體。' : tier === 2 ? '守勢只花 3 內力，防守節奏更密。' : '進度型目標少一個步驟。', moveId: tier === 1 ? `${sect.id}-recover` : tier === 2 ? `${sect.id}-defend` : `${sect.id}-recover` },
] as InsightDefinition[]));
export const insightThresholds = [7, 11, 14];

export function resolvedSectFor(run: Pick<LifeRun, 'sectId' | 'insights'>): Sect {
  if (!run.sectId) return structuredClone(noviceStyle);
  const style = structuredClone(sectFor(run.sectId));
  for (const insightId of run.insights) {
    const insight = insightDefinitions.find((item) => item.id === insightId);
    if (!insight) continue;
    const move = style.moves.find((item) => item.id === insight.moveId);
    if (!move) continue;
    if (insight.tier === 1 && insightId.endsWith('-a')) move.action.effects.push({ type: 'expose-next-hit', percent: .25, recipient: 'target' });
    if (insight.tier === 1 && insightId.endsWith('-b')) move.action.effects.push({ type: 'guard', amount: 9, recipient: 'actor' });
    if (insight.tier === 2 && insightId.endsWith('-a')) move.action.effects.push({ type: 'counter', damage: 12 });
    if (insight.tier === 2 && insightId.endsWith('-b')) { move.qiCost = 3; move.action.qiCost = 3; }
    if (insight.tier === 3 && insightId.endsWith('-a')) move.action.target = 'weakest-enemy';
  }
  return style;
}
export function nextInsightTier(run: LifeRun): 1 | 2 | 3 | null {
  const tierIndex = insightThresholds.findIndex((turn, index) => run.turn >= turn && !run.insights.some((id) => id.includes(`-${index + 1}-`)));
  return tierIndex < 0 ? null : (tierIndex + 1) as 1 | 2 | 3;
}
export function insightChoicesFor(run: LifeRun) {
  const tier = nextInsightTier(run);
  return tier && run.sectId ? insightDefinitions.filter((item) => item.sectId === run.sectId && item.tier === tier) : [];
}
export function chooseInsight(run: LifeRun, insightId: InsightId): LifeRun {
  if (!insightChoicesFor(run).some((item) => item.id === insightId)) return run;
  const insight = insightDefinitions.find((item) => item.id === insightId)!;
  return { ...run, insights: [...run.insights, insightId], chronicle: [...run.chronicle, `${run.year}年：你悟出「${insight.name}」，招式的用法從此不同。`] };
}

function objectiveStateFor(run: LifeRun, choice: LifeChoice, prep: BattlePreparation): BattleObjectiveState {
  const objectiveMutation = run.insights.some((id) => id.endsWith('-3-b')) && choice.objective.type === 'progress' ? 1 : 0;
  const required = Math.max(1, choice.objective.required - (prep.objectiveEase ?? 0) - objectiveMutation);
  return {
    type: choice.objective.type === 'peaceful' ? 'eliminate' : choice.objective.type,
    label: choice.objective.label,
    description: choice.objective.description,
    progress: 0,
    required,
    actionLabel: choice.objective.actionLabel,
    leaderId: choice.objective.type === 'leader' ? 'enemy-1' : undefined,
    protectedActorIds: choice.objective.protect ? ['ward'] : [],
    hostileActions: 0,
    deadline: choice.objective.type === 'progress' ? required + 5 : undefined,
  };
}
export function startBattle(run: LifeRun, choice: LifeChoice): LifeRun {
  if (!choiceAvailable(run, choice) || choice.resolution === 'peaceful') return run;
  const event = eventFor(run);
  const prep = choice.preparation;
  const style = resolvedSectFor(run);
  const actors: BattleActor[] = [playerActor(run, prep), ...enemyActors(run, event, prep)];
  if (choice.objective.protect) actors.push(wardActor(run));
  if (prep.inviteFriend) actors.push(friendActor(run));
  const talents = Object.fromEntries(activeTalentIds(run).map((id) => [id, 1]));
  const setup = {
    seed: `${run.seed}:${event.id}:${choice.id}`, encounterId: event.id, title: event.title, cause: event.conflict, stakes: `${choice.objective.label}；失敗：${choice.objective.failure}`, mandatory: true,
    objective: objectiveStateFor(run, choice, prep), actors, rngIndex: 0,
    resources: { money: run.money - choice.moneyCost, phoneCharges: 0, flags: [...run.turningPoints], talents, strength: run.stats.strength, partySize: actors.filter((actor) => actor.side === 'ally').length },
  };
  const battle = createBattle(setup, rulesFor(style));
  return {
    ...run, money: run.money - choice.moneyCost, battle,
    battleMeta: { eventId: event.id, choiceId: choice.id, growthStat: choice.growthStat, preparation: prep, startedHp: run.hp, initialEnemyCount: battle.actors.filter((actor) => actor.side === 'enemy').length, feedback: { headline: '準備已落定，代價也已付清。', bridge: choice.description, effect: choice.preview, fightReason: choice.objective.description, actionLabel: '進入這一戰 →' } },
    result: null,
  };
}
export function performMove(run: LifeRun, actionId: string): LifeRun {
  if (!run.battle || run.battle.result || run.battle.readyActorId !== 'player') return run;
  const style = resolvedSectFor(run); const rules = rulesFor(style);
  return { ...run, battle: reduceBattle(run.battle, { type: 'use-action', actionId }, rules).state };
}
export function advanceObjective(run: LifeRun): LifeRun {
  if (!run.battle || run.battle.result || run.battle.readyActorId !== 'player') return run;
  const style = resolvedSectFor(run); const rules = rulesFor(style);
  return { ...run, battle: reduceBattle(run.battle, { type: 'advance-objective' }, rules).state };
}
export function advanceBattle(run: LifeRun): LifeRun {
  if (!run.battle || run.battle.result || run.battle.readyActorId === 'player') return run;
  return { ...run, battle: reduceBattle(run.battle, { type: 'advance' }, rulesFor(resolvedSectFor(run))).state };
}
export function selectTarget(run: LifeRun, targetId: string): LifeRun {
  if (!run.battle) return run;
  return { ...run, battle: reduceBattle(run.battle, { type: 'select-target', targetId }, rulesFor(resolvedSectFor(run))).state };
}

function phaseForTurn(turn: number) { return phases.find((phase) => turn >= phase.start && turn <= phase.end) ?? phases.at(-1)!; }
function advanceLife(run: LifeRun, choice: LifeChoice, summary: string): LifeRun {
  const nextTurn = run.turn + 1; const phase = phaseForTurn(Math.min(15, nextTurn)); const pathAmount = run.turn === 0 ? 2 : 1;
  const reputation = run.reputation + (choice.path === 'duelist' ? 2 : hasTalent(run, 'thick-skin') ? 0 : 1);
  return {
    ...run, turn: nextTurn, age: phase.age, year: phase.year, hp: Math.min(run.maxHp, run.hp + Math.round(run.maxHp * buildFor(run).recovery)), qi: run.maxQi,
    money: run.money + (choice.path === 'contractor' ? 6 : 0),
    pathScores: { ...run.pathScores, [choice.path]: run.pathScores[choice.path] + pathAmount }, lastChosenPath: choice.path,
    turningPoints: [...run.turningPoints, choice.turningPoint], consumedTurningPoints: run.turningPoints.length ? uniqueSorted([...run.consumedTurningPoints, run.turningPoints.at(-1)!]) : run.consumedTurningPoints, proficiency: run.proficiency + 1, reputation,
    bond: run.bond + (choice.path === 'protector' ? 2 : 0), friendship: run.friendship + (choice.path === 'protector' ? 2 : 0), rivalry: run.rivalry + (choice.path === 'duelist' ? 2 : 0),
    stats: { ...run.stats, [choice.growthStat]: run.stats[choice.growthStat] + 1 }, moments: [...run.moments, summary], chronicle: [...run.chronicle, `${run.year}年：${summary}`], battle: null, battleMeta: null,
  };
}
export function resolvePeaceful(run: LifeRun, choice: LifeChoice): LifeRun {
  if (!choiceAvailable(run, choice) || choice.resolution !== 'peaceful') return run;
  const event = eventFor(run);
  const paid = { ...run, money: run.money - choice.moneyCost };
  const next = advanceLife(paid, choice, `你在「${event.title}」買到安全路線，沒有拿命替別人的預算補洞。`);
  return { ...next, result: { kind: 'peaceful', won: true, grade: 'S', score: 100, moments: [`和平解決：${event.title}`], line: '你花掉的是銀兩，不是命。', rewards: [choice.preview] } };
}
export function resolveBattle(run: LifeRun): LifeRun {
  if (!run.battle?.result || !run.battleMeta) return run;
  const event = authoredEvents.find((item) => item.id === run.battleMeta!.eventId) ?? eventFor(run);
  const choice = event.choices.find((item) => item.id === run.battleMeta!.choiceId)!;
  const player = run.battle.actors.find((actor) => actor.id === 'player');
  if (run.battle.result === 'defeat' || !player) {
    return { ...run, hp: 0, dead: true, deathReason: event.death.cause, result: { kind: 'battle', won: false, grade: 'C', score: 0, moments: [event.death.title], line: event.death.cause, rewards: [], death: event.death } };
  }
  const healthRatio = player.hp / player.maxHp;
  const optionalThreats = run.battle.actors.filter((actor) => actor.side === 'enemy' && actor.hp <= 0).length;
  const prepScore = (run.battleMeta.preparation.objectiveEase ?? 0) + (run.battleMeta.preparation.removeEnemy ? 1 : 0) + (run.battleMeta.preparation.inviteFriend ? 1 : 0);
  const score = 50 + Math.round(healthRatio * 25) + prepScore * 8 + optionalThreats * 3;
  const grade: BattleResultCard['grade'] = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : 'C';
  const base = { ...run, hp: Math.max(1, Math.round(player.hp)), qi: Math.round(player.qi), money: run.battle.resources.money, result: null };
  const next = advanceLife({ ...base, injury: run.injury + (healthRatio <= .35 ? 1 : 0) }, choice, `你完成「${event.title}」的${choice.objective.label}，剩下 ${Math.round(healthRatio * 100)}% 氣血。`);
  return { ...next, result: { kind: 'battle', won: true, grade, score, moments: [`完成目標：${choice.objective.label}`, prepScore ? '事前準備確實改變了局面' : '你用最直接的代價過關'], line: '評價只看你是否完成真正的事、活得多完整，以及準備是否奏效。', rewards: [choice.preview] } };
}
export function markDeathAward(run: LifeRun, awarded: boolean): LifeRun {
  return run.result?.death ? { ...run, result: { ...run.result, awardedDeathPoint: awarded } } : run;
}

export const needsAdmission = (run: LifeRun) => run.turn >= 3 && !run.sectId && Boolean(run.aspiredSectId) && !run.dead;
export function admitToSect(run: LifeRun): LifeRun {
  if (!needsAdmission(run)) return run;
  const sectId = run.aspiredSectId!; const sect = sectFor(sectId);
  return { ...run, sectId, chronicle: [...run.chronicle, `${run.year}年：你活過三回少年路，${sect.name}正式收入門下。`] };
}
export const isComplete = (run: LifeRun) => run.turn >= 16 && !run.dead;

export function endingFor(run: LifeRun) {
  const primary = dominantPath(run.pathScores, run.lastChosenPath);
  const secondary = (Object.keys(run.pathScores) as PathId[]).filter((path) => path !== primary).sort((a, b) => run.pathScores[b] - run.pathScores[a])[0];
  const emphasis = run.insights.length >= 3 && run.proficiency >= 12 ? 'mastery' : run.friendship + run.bond >= run.money + run.reputation ? 'community' : 'reputation';
  const frames: Record<PathId, Record<typeof emphasis, [string, string]>> = {
    duelist: { mastery: ['一劍成門', '你把門派武學推成後人必經的一條路。'], community: ['有人替你收劍', '你的勝負最後由留下來的人解釋。'], reputation: ['天下題名', '名號與價碼一起流傳，沒人再敢免費請你出手。'] },
    contractor: { mastery: ['招式入契', '你把武學寫進鏢規，讓後人知道風險不是一句豪氣。'], community: ['萬里有人接鏢', '你建立的不是總局，是一張願意互相接手的網。'], reputation: ['總局不倒', '你的名字成了信用，也成了所有欠條最上面那一行。'] },
    protector: { mastery: ['守勢成宗', '你證明保護不是挨打，而是一門改變局面的武學。'], community: ['萬家留燈', '你回頭時，那些被守過的人已能互相守住。'], reputation: ['公義有印', '你把善意變成能運作的制度，也留下被質疑的門。'] },
  };
  const [title, sentence] = frames[primary][emphasis];
  return { title, sentence, primary, secondary, emphasis, sect: sectFor(run.sectId ?? run.aspiredSectId), relationship: run.friendship >= run.rivalry ? `${run.friendName}記得你守過的承諾` : `${run.rivalName}仍把你當作一生尺度`, turningPoints: run.turningPoints.slice(-4) };
}

export type ReferenceRun = { id: string; seed: string; sectId: SectId; dominantPath: PathId; difficulty: DifficultyId; legacyTalents: TalentId[]; tactics: string[] };
export const referenceRuns: ReferenceRun[] = sects.flatMap((sect) => (['duelist', 'contractor', 'protector'] as PathId[]).map((path) => ({
  id: `reference:${sect.id}:${path}`,
  seed: `v15-${sect.id}-${path}`,
  sectId: sect.id,
  dominantPath: path,
  difficulty: 'standard' as const,
  legacyTalents: path === 'contractor' && sect.id === 'huashan' ? ['route-memory', 'pain-generator', 'no-overtime-death'] : [],
  tactics: path === 'duelist' ? ['先打首領', '無首領時清場', '氣血過半以下先守勢'] : path === 'contractor' ? ['優先買和平路線', '否則連續推進交付', '不為評分多按招式'] : ['先護住受保護者', '撤離優先於輸出', '生存目標以守勢換敵方行動'],
})));
export const standardCompletionReference = referenceRuns.find((run) => run.id === 'reference:huashan:contractor')!;

export function validateCampaignContent() {
  const errors: string[] = [];
  if (authoredEvents.length !== 46) errors.push(`事件數應為 46，目前是 ${authoredEvents.length}`);
  if (new Set(authoredEvents.map((event) => event.id)).size !== 46) errors.push('事件 ID 重複');
  if (new Set(allDeathDefinitions.map((death) => death.id)).size !== 46) errors.push('死亡 ID 重複');
  for (const event of authoredEvents) {
    if (event.choices.length !== 3 || uniqueSorted(event.choices.map((choice) => choice.path)).length !== 3) errors.push(`${event.id} 沒有三條路徑方法`);
    if (!event.death.cause || !event.death.hint || !event.death.epitaph) errors.push(`${event.id} 死亡資料不完整`);
    for (const choice of event.choices) if (choice.resolution === 'battle' && choice.objective.type === 'peaceful') errors.push(`${choice.id} 目標與解法矛盾`);
  }
  for (const path of ['duelist', 'contractor', 'protector'] as PathId[]) {
    const menus = authoredEvents.filter((event) => event.path === path).map((event) => event.choices.map((choice) => choice.title).join('|'));
    if (menus.some((menu, index) => index > 0 && menu === menus[index - 1])) errors.push(`${path} 有相鄰重複選單`);
  }
  return errors;
}
