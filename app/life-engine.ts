import { createBattle, reduceBattle, type BattleActionDefinition, type BattleActor, type BattleRules, type BattleState } from './battle';

export type SectId = 'huashan' | 'shaolin' | 'wudang' | 'beggar' | 'emei' | 'tang';
export type InsightId = `${SectId}-${1 | 2 | 3}-${'a' | 'b'}`;
export type DifficultyId = 'relaxed' | 'standard' | 'hard';
export type RarityId = 'common' | 'rare' | 'legendary';
export type IdentityKind = 'origin' | 'trait' | 'burden';
export type LifePhase = '少年' | '入門' | '闖蕩' | '成名' | '晚年';
export type LifeScreen = 'start' | 'reveal' | 'sect' | 'shop' | 'life' | 'prebattle' | 'battle' | 'result' | 'upgrade' | 'insight' | 'ending';
export type StatKey = 'strength' | 'agility' | 'constitution' | 'wisdom' | 'will' | 'luck';
export type ChoiceTag = 'study' | 'bargain' | 'protect' | 'force' | 'trick' | 'parley';
export type LifeResource = 'proficiency' | 'money' | 'reputation' | 'bond' | 'friendship' | 'rivalry' | 'hp' | 'qi';
export type LifePath = 'uncommitted' | 'duelist' | 'contractor' | 'protector';
export type SliceFlag = 'studied-opponent' | 'bought-intel' | 'hired-help' | 'bought-permit' | 'protected-courier' | 'evacuated-neighbors';
export type ShopItemId = '少年-藥布' | '少年-護腕' | '少年-吐納冊' | '入門-練功樁' | '入門-軟甲' | '入門-行氣散' | '闖蕩-精鐵兵器' | '闖蕩-鎖子內襯' | '闖蕩-還神丹' | '成名-名匠兵器' | '成名-護心鏡' | '成名-小還丹' | '晚年-舊兵重磨' | '晚年-鹿皮護膝' | '晚年-參丸';
export type UpgradeId = 'force' | 'armor' | 'vitality' | 'breath' | 'opening-guard' | 'footwork';
export type BattleUpgrade = { id: UpgradeId; rarity: RarityId; acquiredAfterTurn: number };
export type LifeEffect = { type: 'resource'; resource: LifeResource; amount: number } | { type: 'path'; path: LifePath } | { type: 'flag'; flag: SliceFlag };
export type BattlePreparation = { guard?: number; attack?: number; defense?: number; speed?: number; enemyAttack?: number; inviteFriend?: boolean };
export type ChoiceAvailability = { type: 'always' } | { type: 'money'; minimum: number } | { type: 'friendship'; minimum: number } | { type: 'rivalry'; minimum: number } | { type: 'injury'; minimum: number } | { type: 'sect'; sectId: SectId } | { type: 'trait'; name: string } | { type: 'burden'; name: string };
export type ChoiceFeedback = { successHeadline: string; failureHeadline: string; successBridge: string; failureBridge: string; successAction: string; failureAction: string };

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

export type LifeChoice = { id: string; title: string; description: string; sourceLabel?: string; check: { primary: StatKey; secondary: StatKey } | null; tags: ChoiceTag[]; availability: ChoiceAvailability; commitEffects: LifeEffect[]; successEffects: LifeEffect[]; failureEffects: LifeEffect[]; battlePreparation: { success: BattlePreparation; failure: BattlePreparation }; growthStat: StatKey; feedback: ChoiceFeedback; resolution?: 'battle' | 'peaceful'; encounter?: Partial<Pick<LifeEvent, 'title' | 'conflict' | 'objective' | 'enemyName' | 'enemyRole' | 'enemyCount'>> };
export type EncounterObjective = { id: 'duel' | 'ambush' | 'crowd' | 'siege' | 'protect' | 'escape'; label: string; description: string; enemyRole: 'warrior' | 'assassin' | 'tank'; enemyCount: number };
export type LifeEvent = { id: string; title: string; place: string; lead: string; conflict: string; weather: '晴' | '雨' | '風'; objective: EncounterObjective; enemyName: string; enemyRole: 'warrior' | 'assassin' | 'tank'; enemyCount: number; choices: LifeChoice[] };
export type PreparationFeedback = { outcome: 'success' | 'failure'; chance: number; effect: string; headline: string; bridge: string; fightReason: string; actionLabel: string };
export type BattleMeta = { choiceId: string; growthStat: StatKey; choiceSucceeded?: boolean; choiceChance?: number; feedback?: PreparationFeedback; preparation: BattlePreparation; actions: string[]; damageTaken: number; damageDealt: number; startedHp: number; startedQi: number };
export type BattleResultCard = { kind?: 'battle' | 'peaceful'; won: boolean; grade: 'C' | 'B' | 'A' | 'S' | 'SSS'; score: number; moments: string[]; line: string; rewards: string[] };

export type LifeRun = {
  version: 13;
  seed: string;
  name: string;
  origin: string;
  trait: string;
  burden: string;
  difficulty: DifficultyId;
  inheritedTrait: string | null;
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
  lifePath: LifePath;
  sliceFlags: SliceFlag[];
  visitedShops: LifePhase[];
  shopPurchases: ShopItemId[];
  shopAttack: number;
  shopDefense: number;
  shopGuard: number;
  shopMaxHp: number;
  shopMaxQi: number;
  companionJoined: boolean;
  upgrades: BattleUpgrade[];
  pendingUpgrade: boolean;
  upgradeSpeed: number;
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

export const rarities: Array<{ id: RarityId; label: string; chance: number; description: string }> = [
  { id: 'common', label: '普通', chance: 60, description: '常見，但仍然會決定你怎麼活。' },
  { id: 'rare', label: '稀有', chance: 30, description: '比普通更強，也會帶來可預測的小代價。' },
  { id: 'legendary', label: '傳說', chance: 10, description: '足以改變一生的強項，代價也會一路跟著你。' },
];

export const statNames: Record<StatKey, string> = { strength: '力道', agility: '身法', constitution: '根骨', wisdom: '悟性', will: '心性', luck: '福緣' };
export const phases: Array<{ name: LifePhase; start: number; end: number; age: number; year: number; premise: string }> = [
  { name: '少年', start: 0, end: 2, age: 12, year: 1590, premise: '先把今天過完，英雄夢明天再說。' },
  { name: '入門', start: 3, end: 6, age: 18, year: 1596, premise: '門派裡最難的武功，通常叫做人際關係。' },
  { name: '闖蕩', start: 7, end: 10, age: 28, year: 1606, premise: '江湖很大，但欠款人總能準時找到你。' },
  { name: '成名', start: 11, end: 13, age: 40, year: 1618, premise: '名聲是別人送的，帳單是自己收的。' },
  { name: '晚年', start: 14, end: 15, age: 54, year: 1632, premise: '你終於懂了，傳說通常沒有退休金。' },
];
export const difficulties: Array<{ id: DifficultyId; name: string; description: string; enemyScale: number }> = [
  { id: 'relaxed', name: '散步江湖', description: '敵人較寬容；適合看人生怎麼鬧。', enemyScale: -1 },
  { id: 'standard', name: '正經闖蕩', description: '該痛的地方會痛，該笑的地方照笑。', enemyScale: 0 },
  { id: 'hard', name: '名宿的麻煩', description: '敵人更硬，傳奇也比較有面子。', enemyScale: 1 },
];

const strike = (id: string, label: string, target: BattleActionDefinition['target'], qiCost: number, effects: BattleActionDefinition['effects']): BattleActionDefinition => ({ id, label, target, qiCost, effects });

export const sects: Sect[] = [
  {
    id: 'huashan', name: '華山', subtitle: '劍路越長，理由越少', color: '#e7a85f', icon: '劍', style: '連續進招，累積劍式後一口氣收尾。', quip: '師兄說這叫劍意。你看了一下，像是很貴的加班。',
    moves: [
      { id: 'huashan-start', name: '起手式', description: '穩定傷害，累積劍式。', qiCost: 0, action: strike('huashan-start', '起手式', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.06 }, { type: 'apply-status', id: 'sword-form', stacks: 1, recipient: 'actor' }]) },
      { id: 'huashan-break', name: '破雲一線', description: '消耗劍式，狠狠收尾。', qiCost: 12, action: strike('huashan-break', '破雲一線', 'selected-enemy', 12, [{ type: 'consume-status-damage', id: 'sword-form', damagePerStack: 13, statusOwner: 'actor' }, { type: 'damage', multiplier: 1.28 }]) },
      { id: 'huashan-breath', name: '收劍調息', description: '回內力，也把人生放回劍鞘。', qiCost: 0, action: strike('huashan-breath', '收劍調息', 'self', 0, [{ type: 'restore-qi', amount: 12, recipient: 'actor' }, { type: 'guard', amount: 8, recipient: 'actor' }]) },
      { id: 'huashan-screen', name: '回風守勢', description: '擋一下，順便讓人知道你有在上課。', qiCost: 7, action: strike('huashan-screen', '回風守勢', 'self', 7, [{ type: 'counter', damage: 13 }, { type: 'reduce-next-hit', percent: .45, recipient: 'actor' }]) },
    ],
  },
  {
    id: 'shaolin', name: '少林', subtitle: '把麻煩站到沒力', color: '#e8c669', icon: '拳', style: '護體、續航、反震，越被打越難處理。', quip: '師父說忍耐是修行。你覺得他只是沒預算修屋頂。',
    moves: [
      { id: 'shaolin-palm', name: '伏虎掌', description: '穩穩一掌，附帶護體。', qiCost: 0, action: strike('shaolin-palm', '伏虎掌', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.02 }, { type: 'guard', amount: 8, recipient: 'actor' }]) },
      { id: 'shaolin-bell', name: '金鐘撞', description: '有盾才叫輸出，沒有叫意外。', qiCost: 13, action: strike('shaolin-bell', '金鐘撞', 'selected-enemy', 13, [{ type: 'damage', multiplier: 1.45 }, { type: 'guard', amount: 18, recipient: 'actor' }]) },
      { id: 'shaolin-meditate', name: '坐忘', description: '回氣回血，暫時不回訊息。', qiCost: 0, action: strike('shaolin-meditate', '坐忘', 'self', 0, [{ type: 'heal', amount: 18, recipient: 'actor' }, { type: 'restore-qi', amount: 8, recipient: 'actor' }]) },
      { id: 'shaolin-stance', name: '不動明王', description: '下次挨打少一點，嘴硬多一點。', qiCost: 8, action: strike('shaolin-stance', '不動明王', 'self', 8, [{ type: 'guard', amount: 24, recipient: 'actor' }, { type: 'reduce-next-hit', percent: .55, recipient: 'actor' }]) },
    ],
  },
  {
    id: 'wudang', name: '武當', subtitle: '借力可以，借錢不行', color: '#7ab8c5', icon: '太', style: '調息、化勁、反擊，把對方的努力退回去。', quip: '武當講究順勢而為。你第一天就發現勢通常是別人安排的。',
    moves: [
      { id: 'wudang-cloud', name: '雲手', description: '借勢一擊，讓對方先想想。', qiCost: 0, action: strike('wudang-cloud', '雲手', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.04 }, { type: 'expose-next-hit', percent: .2, recipient: 'target' }]) },
      { id: 'wudang-turn', name: '借力打力', description: '先把局面推回去。', qiCost: 11, action: strike('wudang-turn', '借力打力', 'selected-enemy', 11, [{ type: 'damage', multiplier: 1.3 }, { type: 'reduce-next-hit', percent: .4, recipient: 'actor' }]) },
      { id: 'wudang-breath', name: '太和吐納', description: '呼吸一下，世界不一定會好。', qiCost: 0, action: strike('wudang-breath', '太和吐納', 'self', 0, [{ type: 'heal', amount: 12, recipient: 'actor' }, { type: 'restore-qi', amount: 13, recipient: 'actor' }]) },
      { id: 'wudang-circle', name: '圓轉如意', description: '把對方的熱情退貨。', qiCost: 8, action: strike('wudang-circle', '圓轉如意', 'self', 8, [{ type: 'counter', damage: 17 }, { type: 'guard', amount: 12, recipient: 'actor' }]) },
    ],
  },
  {
    id: 'beggar', name: '丐幫', subtitle: '人脈很廣，住處很窄', color: '#92b86d', icon: '棍', style: '連打、回氣、靠一點人情和很多臉皮。', quip: '丐幫消息最快，因為大家都在路邊，沒有會議室可以躲。',
    moves: [
      { id: 'beggar-stick', name: '打狗棒影', description: '一棍先問候，第二棍再解釋。', qiCost: 0, action: strike('beggar-stick', '打狗棒影', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.1 }]) },
      { id: 'beggar-wave', name: '百家一棍', description: '把街坊的意見集中寄出。', qiCost: 12, action: strike('beggar-wave', '百家一棍', 'selected-enemy', 12, [{ type: 'damage', multiplier: 1.5 }, { type: 'restore-qi', amount: 5, recipient: 'actor' }]) },
      { id: 'beggar-wine', name: '一口濁酒', description: '不保證衛生，保證有精神。', qiCost: 0, action: strike('beggar-wine', '一口濁酒', 'self', 0, [{ type: 'heal', amount: 15, recipient: 'actor' }, { type: 'restore-qi', amount: 10, recipient: 'actor' }]) },
      { id: 'beggar-footwork', name: '巷口步', description: '先退半步，讓他以為自己贏了。', qiCost: 7, action: strike('beggar-footwork', '巷口步', 'self', 7, [{ type: 'guard', amount: 16, recipient: 'actor' }, { type: 'counter', damage: 12 }]) },
    ],
  },
  {
    id: 'emei', name: '峨眉', subtitle: '手很穩，耐心有限', color: '#c88cad', icon: '針', style: '點穴、精準與照料，讓對方每一步都不舒服。', quip: '峨眉的規矩不多，主要是每條都能讓你後悔。',
    moves: [
      { id: 'emei-needle', name: '拂塵點穴', description: '精準一擊，讓對方先別急。', qiCost: 0, action: strike('emei-needle', '拂塵點穴', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.05 }, { type: 'expose-next-hit', percent: .25, recipient: 'target' }]) },
      { id: 'emei-moon', name: '月影封脈', description: '把你的人生行程往後排。', qiCost: 12, action: strike('emei-moon', '月影封脈', 'selected-enemy', 12, [{ type: 'damage', multiplier: 1.35 }, { type: 'apply-status', id: 'toxin', stacks: 1, recipient: 'target' }]) },
      { id: 'emei-medicine', name: '靜心敷藥', description: '先照顧自己，這不叫自私。', qiCost: 0, action: strike('emei-medicine', '靜心敷藥', 'self', 0, [{ type: 'heal', amount: 22, recipient: 'actor' }]) },
      { id: 'emei-parry', name: '清規攔人', description: '拒絕得很有禮貌，但很難過。', qiCost: 7, action: strike('emei-parry', '清規攔人', 'self', 7, [{ type: 'guard', amount: 14, recipient: 'actor' }, { type: 'counter', damage: 15 }]) },
    ],
  },
  {
    id: 'tang', name: '唐門', subtitle: '不近人情，近距離很危險', color: '#a681d1', icon: '鏢', style: '暗器、毒性、延遲，讓戰鬥自己變糟。', quip: '唐門說暗器是藝術。你看帳單後覺得確實很藝術。',
    moves: [
      { id: 'tang-needle', name: '細雨針', description: '傷害不高，心情會慢慢變差。', qiCost: 0, action: strike('tang-needle', '細雨針', 'selected-enemy', 0, [{ type: 'damage', multiplier: .92 }, { type: 'apply-status', id: 'toxin', stacks: 1, recipient: 'target' }]) },
      { id: 'tang-bloom', name: '暴雨梨花', description: '把累積的不滿一次寄出。', qiCost: 12, action: strike('tang-bloom', '暴雨梨花', 'selected-enemy', 12, [{ type: 'consume-status-damage', id: 'toxin', damagePerStack: 18, statusOwner: 'target' }, { type: 'damage', multiplier: 1.18 }]) },
      { id: 'tang-antidote', name: '以毒養氣', description: '聽起來不健康，但有效。', qiCost: 0, action: strike('tang-antidote', '以毒養氣', 'self', 0, [{ type: 'heal', amount: 15, recipient: 'actor' }, { type: 'restore-qi', amount: 10, recipient: 'actor' }]) },
      { id: 'tang-smoke', name: '迷煙退場', description: '不叫逃跑，叫保留選項。', qiCost: 8, action: strike('tang-smoke', '迷煙退場', 'self', 8, [{ type: 'guard', amount: 18, recipient: 'actor' }, { type: 'counter', damage: 10 }]) },
    ],
  },
];

export const origins = ['藥鋪學徒', '鏢局雜役', '沒落軍戶', '寺外棄童', '商隊小孩', '縣城學徒'] as const;
export const traits = [
  '吃苦耐勞', '臉皮很厚', '手腳俐落', '會看人臉色', '記路很牢', '不愛空手回家',
  '雨天手穩', '很會記仇', '人多反而冷靜', '越窮越有志氣', '先禮後兵', '氣走得太急',
  '過目不忘', '運氣不太好', '天妒英才', '百脈俱通', '背水才會贏', '四海皆兄弟',
] as const;
export const burdens = ['家裡欠了錢', '有人等你回家', '師父欠你一句道歉', '你其實很怕打架', '一封信一直沒寄', '大家以為你很有錢'] as const;
const identityRarities: Record<IdentityKind, Record<string, RarityId>> = {
  origin: { '藥鋪學徒': 'common', '鏢局雜役': 'common', '縣城學徒': 'rare', '商隊小孩': 'rare', '沒落軍戶': 'legendary', '寺外棄童': 'legendary' },
  trait: {
    '臉皮很厚': 'common', '會看人臉色': 'common', '記路很牢': 'common', '不愛空手回家': 'common', '雨天手穩': 'common', '很會記仇': 'common',
    '手腳俐落': 'rare', '人多反而冷靜': 'rare', '越窮越有志氣': 'rare', '先禮後兵': 'rare', '氣走得太急': 'rare', '過目不忘': 'rare',
    '吃苦耐勞': 'legendary', '運氣不太好': 'legendary', '天妒英才': 'legendary', '百脈俱通': 'legendary', '背水才會贏': 'legendary', '四海皆兄弟': 'legendary',
  },
  burden: { '家裡欠了錢': 'common', '大家以為你很有錢': 'common', '師父欠你一句道歉': 'rare', '一封信一直沒寄': 'rare', '有人等你回家': 'legendary', '你其實很怕打架': 'legendary' },
};
const friends = ['阿棠', '石見山', '柳小七', '顧晚舟', '沈二娘', '唐十三'];
const rivals = ['范少白', '段鐵嘴', '莫問天', '金如意', '霍三娘', '葉無聲'];

function rarityFromSeed(seed: string) {
  const roll = range(seed, 1, 100);
  let ceiling = 0;
  return rarities.find((rarity) => { ceiling += rarity.chance; return roll <= ceiling; }) ?? rarities[0];
}

function pickIdentity<T extends string>(kind: IdentityKind, items: readonly T[], seed: string, excluded?: string | null): T {
  const rarity = rarityFromSeed(`${seed}:rarity`);
  const pool = items.filter((item) => identityRarities[kind][item] === rarity.id && item !== excluded);
  return pick(pool.length ? pool : items, `${seed}:value:${rarity.id}`);
}

const originBonus: Record<(typeof origins)[number], Partial<Record<StatKey, number>> & { money?: number }> = {
  '藥鋪學徒': { wisdom: 1, will: 1 }, '鏢局雜役': { agility: 1, constitution: 1 },
  '縣城學徒': { wisdom: 3, money: -4 }, '商隊小孩': { luck: 2, constitution: -1, money: 12 },
  '沒落軍戶': { strength: 3, will: 2, luck: -1, money: -8 }, '寺外棄童': { constitution: 3, luck: 3, wisdom: -1, money: -8 },
};
const originCopy: Record<(typeof origins)[number], string> = {
  '藥鋪學徒': '悟性 +1、心性 +1。尋常手藝，沒有額外代價。', '鏢局雜役': '身法 +1、根骨 +1。搬得多，跑得也快。',
  '縣城學徒': '悟性 +3；拜師與紙墨讓開局銀兩 -4。', '商隊小孩': '福緣 +2、銀兩 +12；長年奔波讓根骨 -1。',
  '沒落軍戶': '力道 +3、心性 +2；福緣 -1、開局銀兩 -8。家傳還在，家產不在。', '寺外棄童': '根骨 +3、福緣 +3；悟性 -1、開局銀兩 -8。很能活，沒人替你交學費。',
};
const burdenBonus: Partial<Record<(typeof burdens)[number], Partial<Record<StatKey, number>> & { money?: number }>> = {
  '一封信一直沒寄': { will: 3, money: -8 },
};
const traitCopy: Record<(typeof traits)[number], string> = {
  '過目不忘': '研習類準備成功時造詣加倍；但每次深入研習氣血 -8。記得太清楚，也比較不會停。', '雨天手穩': '雨天攻擊 +8；無雨時攻擊 -2。手穩，天氣不一定配合。', '很會記仇': '每 2 點宿敵提供攻擊 +3；每點宿敵令戰後恢復少 2%，最低 40%。',
  '吃苦耐勞': '最大氣血 +12；勝戰後恢復最大氣血 72%（原為 60%）；速度 -1。你很能熬，快是另一回事。', '臉皮很厚': '議價類準備成功時銀兩 +4，成功率 +15%。臉皮沒變薄，荷包比較沒那麼薄。', '運氣不太好': '每場敵人攻擊 +2；勝戰造詣額外 +14。麻煩更多，活下來也悟得更多。',
  '手腳俐落': '每場速度 +2。你不一定想得快，但通常先動。', '會看人臉色': '管閒事時人情與交情額外 +1。先看懂，再伸手。',
  '記路很牢': '風天戰鬥防禦 +3。別人忙著擋風，你還記得退路。', '不愛空手回家': '每場勝戰多帶回銀兩 +2。多少都算有交代。',
  '人多反而冷靜': '面對兩名以上敵人攻擊 +7；單挑時攻擊 -2。人少了，反而不知道看誰。', '越窮越有志氣': '銀兩不超過 10 時攻擊 +7；有錢時攻擊 -2。安逸會讓你分心。',
  '先禮後兵': '管閒事開戰護盾額外 +20；用其他方式準備時攻擊 -2。禮數做足，才比較下得了手。', '氣走得太急': '每場開戰內力至多 +12；氣血 -5。內力先到了，人還在後面。',
  '天妒英才': '所有潛力 +4，成長時一次 +2；但最大氣血 -18。路很高，身子不一定跟得上。', '百脈俱通': '最大內力 +24；最大氣血 -14。運氣很寬，命比較薄。',
  '背水才會贏': '開戰氣血至多保留 55%，換取攻擊 +14、護盾 +14。你總要快輸了才像會贏。', '四海皆兄弟': '管閒事時人情與交情 +6，交情 3 就有朋友助戰；獨自上場時攻擊 -5。',
};
const burdenCopy: Record<(typeof burdens)[number], string> = {
  '家裡欠了錢': '開局銀兩 -6；議價成功時再少賺 2。', '有人等你回家': '保護他人成功時人情與交情各額外 +2。有人等，所以你更知道要把誰送回去。', '師父欠你一句道歉': '入門期攻擊 +7；其他人生階段攻擊 -2。這口氣很強，也很窄。',
  '你其實很怕打架': '每場先得護盾 +16；攻擊 -3。怕得有用，打得保守。', '一封信一直沒寄': '心性 +3；開局銀兩 -8。你把盤纏花在找一個始終沒寄出的地址。', '大家以為你很有錢': '議價成功時少賺 3。名聲先到了，錢沒有。',
};

export function identityDetail(kind: IdentityKind, value: string) {
  if (kind === 'origin') return originCopy[value as keyof typeof originCopy];
  return kind === 'trait' ? traitCopy[value as keyof typeof traitCopy] : burdenCopy[value as keyof typeof burdenCopy];
}

export function identityRarity(kind: IdentityKind, value: string) {
  const id = identityRarities[kind][value] ?? 'common';
  return rarities.find((rarity) => rarity.id === id) ?? rarities[0];
}

export function hasTalent(run: Pick<LifeRun, 'trait' | 'inheritedTrait'>, talent: string) {
  return run.trait === talent || run.inheritedTrait === talent;
}

export function phaseForTurn(turn: number) { return phases.find((phase) => turn >= phase.start && turn <= phase.end) ?? phases.at(-1)!; }
export function sectFor(id: SectId | null) { return sects.find((sect) => sect.id === id) ?? sects[0]; }
export function difficultyFor(id: DifficultyId) { return difficulties.find((difficulty) => difficulty.id === id) ?? difficulties[1]; }
function maximumHp(stats: Record<StatKey, number>, talents: Pick<LifeRun, 'trait' | 'inheritedTrait'>) {
  return 66 + stats.constitution * 7 + ('shopMaxHp' in talents && typeof talents.shopMaxHp === 'number' ? talents.shopMaxHp : 0) + (hasTalent(talents, '吃苦耐勞') ? 12 : 0) - (hasTalent(talents, '天妒英才') ? 18 : 0) - (hasTalent(talents, '百脈俱通') ? 14 : 0);
}
function maximumQi(stats: Record<StatKey, number>, talents: Pick<LifeRun, 'trait' | 'inheritedTrait'>) {
  return 24 + stats.will * 3 + ('shopMaxQi' in talents && typeof talents.shopMaxQi === 'number' ? talents.shopMaxQi : 0) + (hasTalent(talents, '百脈俱通') ? 24 : 0);
}
const tagTalentBonuses: Partial<Record<ChoiceTag, Array<[string, number]>>> = {
  study: [['過目不忘', 15], ['吃苦耐勞', 8]], bargain: [['臉皮很厚', 15], ['不愛空手回家', 8]], protect: [['會看人臉色', 15], ['四海皆兄弟', 15]], trick: [['手腳俐落', 12], ['記路很牢', 8]], force: [['很會記仇', 10]], parley: [['先禮後兵', 12]],
};
function choiceBonuses(run: LifeRun, choice: LifeChoice) {
  return choice.tags.flatMap((tag) => tagTalentBonuses[tag] ?? []).filter(([talent]) => hasTalent(run, talent));
}
export function choiceChanceFor(run: LifeRun, choice: LifeChoice) {
  if (!choice.check) return 100;
  const talentBonus = choiceBonuses(run, choice).reduce((total, [, bonus]) => total + bonus, 0);
  return Math.max(35, Math.min(92, 30 + run.stats[choice.check.primary] * 4 + run.stats[choice.check.secondary] * 2 + talentBonus));
}
export function choiceChanceDetailFor(run: LifeRun, choice: LifeChoice) {
  if (!choice.check) return '不需檢定 · 付得起就成立';
  const bonuses = choiceBonuses(run, choice).map(([talent, bonus]) => `${talent} +${bonus}%`);
  return `${statNames[choice.check.primary]} ${run.stats[choice.check.primary]}、${statNames[choice.check.secondary]} ${run.stats[choice.check.secondary]}${bonuses.length ? ` · ${bonuses.join('、')}` : ''}`;
}
export function choiceSucceededFor(run: LifeRun, choice: LifeChoice) {
  return range(`${run.seed}:choice:${run.turn}:${choice.id}`, 1, 100) <= choiceChanceFor(run, choice);
}
function adjustedEffects(run: LifeRun, choice: LifeChoice, effects: LifeEffect[]) {
  const adjusted = effects.map((effect) => ({ ...effect }));
  if (choice.tags.includes('study') && hasTalent(run, '過目不忘')) {
    let studied = false;
    for (const effect of adjusted) if (effect.type === 'resource' && effect.resource === 'proficiency' && effect.amount > 0) { effect.amount *= 2; studied = true; }
    if (studied) adjusted.push({ type: 'resource', resource: 'hp', amount: -8 });
  }
  if (choice.tags.includes('bargain')) {
    for (const effect of adjusted) if (effect.type === 'resource' && effect.resource === 'money' && effect.amount > 0) effect.amount += (hasTalent(run, '臉皮很厚') ? 4 : 0) - (run.burden === '家裡欠了錢' ? 2 : 0) - (run.burden === '大家以為你很有錢' ? 3 : 0);
  }
  if (choice.tags.includes('protect')) {
    for (const effect of adjusted) if (effect.type === 'resource' && (effect.resource === 'bond' || effect.resource === 'friendship') && effect.amount > 0) effect.amount += (run.burden === '有人等你回家' ? 2 : 0) + (hasTalent(run, '會看人臉色') ? 1 : 0) + (hasTalent(run, '四海皆兄弟') ? 3 : 0);
  }
  return adjusted;
}
const resourceLabels: Record<LifeResource, string> = { proficiency: '造詣', money: '銀兩', reputation: '名聲', bond: '人情', friendship: '交情', rivalry: '芥蒂', hp: '氣血', qi: '內力' };
function describePreparation(preparation: BattlePreparation) {
  return [preparation.guard ? `起手護體 +${preparation.guard}` : '', preparation.attack ? `本戰力道 +${preparation.attack}` : '', preparation.defense ? `本戰防禦 +${preparation.defense}` : '', preparation.speed ? `本戰身法 +${preparation.speed}` : '', preparation.enemyAttack ? `敵方攻擊 ${preparation.enemyAttack > 0 ? '+' : ''}${preparation.enemyAttack}` : '', preparation.inviteFriend ? '朋友助戰' : ''].filter(Boolean);
}
export function describeChoiceEffects(run: LifeRun, choice: LifeChoice, succeeded: boolean) {
  const outcomeEffects = adjustedEffects(run, choice, succeeded ? choice.successEffects : choice.failureEffects);
  const effects = [...adjustedEffects(run, choice, choice.commitEffects), ...outcomeEffects];
  const totals = effects.filter((effect): effect is Extract<LifeEffect, { type: 'resource' }> => effect.type === 'resource').reduce<Partial<Record<LifeResource, number>>>((result, effect) => ({ ...result, [effect.resource]: (result[effect.resource] ?? 0) + effect.amount }), {});
  const all = (Object.entries(totals) as Array<[LifeResource, number]>).filter(([, amount]) => amount !== 0).map(([resource, amount]) => `${resourceLabels[resource]} ${amount >= 0 ? '+' : ''}${amount}`);
  const causal = effects.flatMap((effect) => effect.type === 'path' ? [`人生路線：${effect.path === 'duelist' ? '以武求名' : effect.path === 'contractor' ? '靠差事吃飯' : effect.path === 'protector' ? '先護住人' : '未定'}`] : effect.type === 'flag' ? [`留下線索：${effect.flag === 'bought-intel' ? '已買情報' : effect.flag === 'hired-help' ? '已僱人手' : effect.flag === 'bought-permit' ? '已買通行文書' : effect.flag === 'protected-courier' ? '護住送信人' : effect.flag === 'evacuated-neighbors' ? '撤出街坊' : '看過對手'}`] : []);
  return [...all, ...causal, ...describePreparation(succeeded ? choice.battlePreparation.success : choice.battlePreparation.failure)].join('、') || '沒有額外效果';
}
export function choiceCommitmentFor(run: LifeRun, choice: LifeChoice) {
  return adjustedEffects(run, choice, choice.commitEffects).filter((effect): effect is Extract<LifeEffect, { type: 'resource' }> => effect.type === 'resource').map((effect) => `${resourceLabels[effect.resource]} ${effect.amount >= 0 ? '+' : ''}${effect.amount}`).join('、');
}
export function choiceRewardFor(run: LifeRun, choice: LifeChoice) { return describeChoiceEffects(run, choice, true); }
export function choiceFailureFor(run: LifeRun, choice: LifeChoice) { return describeChoiceEffects(run, choice, false); }

export function preparationFeedbackFor(run: LifeRun, event: LifeEvent, choice: LifeChoice, succeeded = choiceSucceededFor(run, choice)): PreparationFeedback {
  const outcome = succeeded ? 'success' : 'failure';
  return { outcome, chance: choiceChanceFor(run, choice), effect: describeChoiceEffects(run, choice, succeeded), headline: succeeded ? choice.feedback.successHeadline : choice.feedback.failureHeadline, bridge: succeeded ? choice.feedback.successBridge : choice.feedback.failureBridge, actionLabel: succeeded ? choice.feedback.successAction : choice.feedback.failureAction, fightReason: event.conflict };
}

export function newLife(seed: string, name: string, difficulty: DifficultyId = 'standard', inheritedTrait: string | null = null): LifeRun {
  const carriedTrait = inheritedTrait && traits.includes(inheritedTrait as (typeof traits)[number]) ? inheritedTrait : null;
  const origin = pickIdentity('origin', origins, `${seed}:origin`);
  const trait = pickIdentity('trait', traits, `${seed}:trait`, carriedTrait);
  const burden = pickIdentity('burden', burdens, `${seed}:burden`);
  const talentState = { trait, inheritedTrait: carriedTrait };
  const stats = Object.fromEntries((Object.keys(statNames) as StatKey[]).map((key) => [key, range(`${seed}:${key}`, 3, 7) + (originBonus[origin][key] ?? 0) + (burdenBonus[burden]?.[key] ?? 0)])) as Record<StatKey, number>;
  const potential = Object.fromEntries((Object.keys(statNames) as StatKey[]).map((key) => [key, stats[key] + range(`${seed}:potential:${key}`, 3, 6) + (hasTalent(talentState, '天妒英才') ? 4 : 0)])) as Record<StatKey, number>;
  const maxHp = maximumHp(stats, talentState);
  const maxQi = maximumQi(stats, talentState);
  const money = Math.max(0, range(`${seed}:money`, 8, 22) + (originBonus[origin].money ?? 0) + (burdenBonus[burden]?.money ?? 0) - (burden === '家裡欠了錢' ? 6 : 0));
  return { version: 13, seed, name: name.trim() || '無名少俠', origin, trait, burden, difficulty, inheritedTrait: carriedTrait, sectId: null, age: 12, year: 1590, turn: 0, stats, potential, hp: maxHp, maxHp, qi: maxQi, maxQi, money, lifePath: 'uncommitted', sliceFlags: [], visitedShops: [], shopPurchases: [], shopAttack: 0, shopDefense: 0, shopGuard: 0, shopMaxHp: 0, shopMaxQi: 0, companionJoined: false, upgrades: [], pendingUpgrade: false, upgradeSpeed: 0, proficiency: 0, insights: [], reputation: 0, bond: 0, friendName: pick(friends, `${seed}:friend`), rivalName: pick(rivals, `${seed}:rival`), friendship: 0, rivalry: 0, injury: 0, dead: false, deathReason: null, moments: [], chronicle: [], battle: null, battleMeta: null, result: null };
}

function baseEventFor(run: LifeRun): Omit<LifeEvent, 'choices'> {
  const phase = phaseForTurn(run.turn);
  const sect = sectFor(run.sectId);
  const themes: Record<LifePhase, Array<{ title: string; place: string; lead: string; conflict: string; enemy: string }>> = {
    少年: [
      { title: '柴房的第一堂課', place: '城外破廟', lead: '你抱著鋪蓋走進破廟，只想借柴房躲一夜雨。三個地痞卻把門閂上，說連破屋也要繳「落腳錢」。', conflict: '他們扣住你的行囊，短刀已經出鞘；不把門前的人逼退，你和鋪蓋都走不出去。', enemy: '地痞' },
      { title: '學費可以晚點交嗎', place: '山門石階', lead: '你踩著晨霧走到山門，招收弟子的告示寫得很有氣勢，收費細則寫得更有。你問能否晚交第一筆學費，看門弟子便把你的名字圈進「以試代繳」那一欄。', conflict: '規矩很直白：想跨過山門，就在石階前打贏看門弟子；現在退下，今年的名額便作廢。', enemy: '看門弟子' },
      { title: '把人送回家', place: '夜市巷口', lead: '收攤後，你替一名腳夫扛貨回家。他說只隔兩條街，走到第二條時，幾個醉漢已把欠酒錢算在他頭上。', conflict: '醉漢堵死巷口，伸手搶貨，還把腳夫推倒在地；你若要把人和貨一起送到家，就得先清出一條路。', enemy: '攔路醉漢' },
    ],
    入門: [
      { title: '三十桶水少了五桶', place: '後山演武場', lead: `${sect.name}叫你把三十桶水送上演武場，說這叫磨練心性。走到半山，你撞見幾名師兄正把其中五桶轉賣給山下酒樓。`, conflict: '領頭師兄要你當作沒看見，手卻已按上兵器；水送不齊，受罰的是你，想送齊就得從他手裡拿回來。', enemy: '截水師兄' },
      { title: '師兄說只是切磋', place: '練功房', lead: '一名師兄當眾說要替你「測試程度」，旁邊的人很快擺好傷藥，也很快開了賭盤。你婉拒一次，他便把練功房的門扣上。', conflict: '這已不是一句玩笑：他要用你立威，不肯讓路；你若不接招，今天便只能躺著出去。', enemy: '熱心師兄' },
      { title: '三文錢的山門顏面', place: '市集', lead: '你奉命下山買鹽，攤販卻說上回來的同門還欠三文錢。你正要掏錢，攤後的打手已把整袋門派採買扣下。', conflict: '打手認定你會為了山門顏面忍氣吞聲，連人帶貨一起圍住；鹽可以不要，但你得先保住同行的小弟子。', enemy: '攤販打手' },
      { title: '公告欄上寫著你的名字', place: '山門外', lead: '有人在公告欄貼了匿名戰帖，把你的名字寫得比罪名還大。你撕下紙張時，一名蒙面人從樹後落地，說總算等到本人。', conflict: '對方拔劍封住回山的石徑，堅持今日要分勝負；戰帖是不是誤會，得先活過這一場才有機會問。', enemy: '蒙面挑戰者' },
    ],
    闖蕩: [
      { title: '客戶說路上很安全', place: '鏢局外', lead: '委託人把一只封死的木匣交給你，反覆保證路上絕對安全。你才走出鏢局後巷，攔路客便準確叫出木匣上的暗記。', conflict: '對方不要錢，只要匣子，前後出口也都有人守著；這份差事從起步就只剩打出去一條路。', enemy: '攔路客' },
      { title: '英雄沒有船票折扣', place: '河渡', lead: '船夫認出你的名號後不但沒減價，還說載名人風險高，要多收一份。價錢尚未談完，河盜的鉤索已扣上船舷。', conflict: '河盜先割纜繩、再跳上甲板，船退不回岸；你若不把他們逼下船，滿船乘客都會順流進賊寨。', enemy: '河盜' },
      { title: '說書人把你講成三百回', place: '茶樓', lead: '你的一場小衝突被說書人添成三百回，連你本人都聽得很有興趣。台下卻有人摔碗起身，說要當場拆穿這樁假名聲。', conflict: '挑戰者把桌椅推開，兵器直指你胸口；茶樓後門已被他的同伴守住，這場驗證顯然不收口頭答覆。', enemy: '慕名挑戰者' },
      { title: '漏雨的房也有人催租', place: '縣城客棧', lead: '客棧屋頂漏水，掌櫃卻說那是自然景觀，房價不能降。你還在擰乾被褥，催租打手已進門拿走隔壁寡婦的藥箱抵債。', conflict: '你攔住藥箱，打手便反鎖客棧大門，叫所有欠租的人一起看清規矩；要把藥留下，你得先站住。', enemy: '催租打手' },
    ],
    成名: [
      { title: '這場訪談沒有最後一題', place: '大酒樓', lead: '一名文士說要替你作傳，問題從武學一路問到婚配，連你都開始同情自己。酒樓忽然清場，你才看見採訪桌下藏著一排短刃。', conflict: '所謂訪談只是把你留在固定座位；蹭名挑戰者已帶人封住樓梯，要拿你的敗績替自己寫第一章。', enemy: '蹭名挑戰者' },
      { title: '你的名號已被別人買走', place: '商會', lead: '商會說你的名號早被註冊，用來賣護身符與跌打酒。你拿出自己的臉作證，管事卻說臉不在契紙上。', conflict: '你要求停賣假貨，商會護衛便把大門合上，要你留下手印再走；那手印看起來需要連手一起留下。', enemy: '商會護衛' },
      { title: '舊友說這不是借錢', place: '雨亭', lead: '舊友說不是來借錢，只想請你陪他和債主談一件很小的事。你趕到雨亭時，才發現「很小」指的是還款期限，不是債。', conflict: '債主的人押住舊友，還要拿他的家人抵帳；你既然露面，對方便決定連你的名聲也一起收走。', enemy: '索命債主' },
    ],
    晚年: [
      { title: '年輕人想替江湖換榜', place: '山道', lead: '一名新秀在山道攔你，說你的招式太老、名字卻佔榜太久。你同意前半句，正想繞過去，他已把劍鞘橫在路中。', conflict: '新秀要用擊敗你替自己換榜，還帶人封住下山路；若你想平安回去，只能讓他親自見識歷史有多重。', enemy: '換榜新秀' },
      { title: '最後一份委託沒有酬金', place: '荒村', lead: '你本來只想回家，荒村的孩子卻把一串染血的門牌塞進你手裡。多年前放走的仇家如今帶人回來，要全村替舊帳付利息。', conflict: '村口已起火，舊怨的人馬正逐戶搜人；你可以晚點退休，但村民等不到明天。', enemy: '多年舊怨' },
    ],
  };
  const orderedThemes = [...themes[phase.name]].sort((left, right) => hash(`${run.seed}:event-deck:${phase.name}:${left.title}`) - hash(`${run.seed}:event-deck:${phase.name}:${right.title}`));
  const template = orderedThemes[(run.turn - phase.start) % orderedThemes.length];
  const power = 1 + Math.floor(run.turn / 3);
  const weather = pick(['晴', '雨', '風'] as const, `${run.seed}:weather:${run.turn}`);
  const objective = pick<EncounterObjective>([
    { id: 'duel', label: '當眾分勝負', description: '一對一，輸的人要假裝自己只是路過。', enemyRole: 'warrior', enemyCount: 1 },
    { id: 'ambush', label: '撐過伏擊', description: '對方很會搶先手；你得先把隊形打散。', enemyRole: 'assassin', enemyCount: 2 },
    { id: 'crowd', label: '清出一條路', description: '人多不一定厲害，但很容易把你堵在角落。', enemyRole: 'warrior', enemyCount: 2 + (power > 3 ? 1 : 0) },
    { id: 'siege', label: '拆掉硬骨頭', description: '這人很耐打。你需要耐心，或很大的聲音。', enemyRole: 'tank', enemyCount: 1 + (power > 4 ? 1 : 0) },
  ], `${run.seed}:objective:${run.turn}`);
  const rivalScene = run.turn === 6 || run.turn === 12;
  const rivalObjective: EncounterObjective = { id: 'duel', label: run.turn === 6 ? '第一次算帳' : '舊帳重提', description: `${run.rivalName}說這次不是挑釁，只是剛好帶了兵器。`, enemyRole: 'warrior', enemyCount: 1 };
  const enemyName = rivalScene ? run.rivalName : template.enemy;
  const conflict = rivalScene
    ? (run.turn === 6 ? `${run.rivalName}拔出兵器堵住回山的石階，要你當眾認輸；今日若不分高下，誰也不會讓路。` : `${run.rivalName}已請人封住茶樓兩端，這次要用一場勝負替多年的舊帳落款。`)
    : template.conflict;
  const templateIndex = themes[phase.name].findIndex((item) => item.title === template.title);
  return { id: rivalScene ? `rival-${run.turn}` : `${phase.name}-${templateIndex}`, title: rivalScene ? (run.turn === 6 ? '那個人又來了' : '名聲總會帶人回來') : template.title, place: rivalScene ? (run.turn === 6 ? '山門外石階' : '雨後茶樓') : template.place, lead: rivalScene ? (run.turn === 6 ? `${run.rivalName}說你最近太得意，還當眾翻出你們入門以來的每一筆舊帳。你回想了一下，自己明明只是在正常呼吸。` : `${run.rivalName}隔著人群叫出你的名字，桌上還擺著你們當年沒喝完的那壺酒。這一次，旁邊已經有人開始替你們點評。`) : template.lead, conflict, weather, objective: rivalScene ? rivalObjective : objective, enemyName, enemyRole: rivalScene ? rivalObjective.enemyRole : objective.enemyRole, enemyCount: rivalScene ? rivalObjective.enemyCount : objective.enemyCount };
}

type ChoiceKind = ChoiceTag;
type AuthoredChoice = { kind: ChoiceKind; title: string; description: string };
export const eventChoiceCopy: Record<string, [AuthoredChoice, AuthoredChoice, string]> = {
  '柴房的第一堂課': [{ kind: 'trick', title: '踢倒柴堆卡住門', description: '借破廟裡現成的木頭拆開包圍；路會變窄，你也得在灰塵裡先動手。' }, { kind: 'parley', title: '逐筆問清這間破屋歸誰', description: '逼地痞自己說穿這筆落腳錢沒有主人；說得動就能搶到氣勢，說不動便先挨一下。' }, '借香爐照本門步法站穩'],
  '學費可以晚點交嗎': [{ kind: 'study', title: '先看石階上的舊腳印', description: '從歷屆考生留下的痕跡猜看門弟子的起手，拿悟性換一個較穩的開局。' }, { kind: 'force', title: '請他把試代繳寫進規矩', description: '當眾接下這場考驗，讓所有人都看見勝負與學費不是同一筆帳。' }, '用本門口訣回敬這場入門試'],
  '把人送回家': [{ kind: 'protect', title: '把貨繩繫在自己腰上', description: '先讓腳夫退到牆邊，自己連人帶貨守住巷口；護得住人，也會成為最醒目的目標。' }, { kind: 'trick', title: '把酒罈滾進醉漢腳下', description: '利用滿地雜物拆開人群，成了能搶先手，失手便會讓巷子更亂。' }, '踩著巷牆走本門短路'],
  '三十桶水少了五桶': [{ kind: 'study', title: '從濕腳印找出藏水處', description: '先找回被轉賣的水，再照師兄搬桶時露出的破綻準備迎戰。' }, { kind: 'parley', title: '請所有人一起數到三十', description: '把帳攤在演武場眾人面前；說服旁觀者能替你站穩道理，失敗就只剩自己站穩。' }, '借水桶排成本門起手陣'],
  '師兄說只是切磋': [{ kind: 'force', title: '先把賭盤押在自己身上', description: '把這場立威變成你的公開挑戰；氣勢與名聲都可能到手，代價是沒有退路。' }, { kind: 'trick', title: '挪走練功房的傷藥', description: '逼圍觀師兄先分心保住賭本，再從空出的角度搶一個起手。' }, '按本門規矩行一次正式切磋禮'],
  '三文錢的山門顏面': [{ kind: 'bargain', title: '把三文欠帳拆成三張收據', description: '逐張核對誰欠了什麼，談成便連貨與面子一起拿回，談崩則要自己墊錢。' }, { kind: 'protect', title: '讓小弟子抱鹽先走', description: '你留下擋住攤販打手，換同行的人安全離開，也讓朋友知道你沒有先算自己。' }, '用本門身法護住整袋鹽'],
  '公告欄上寫著你的名字': [{ kind: 'study', title: '把戰帖折成對方的步幅', description: '從落款、劍痕與紙上泥點推回蒙面人的架勢，讓匿名少藏一點。' }, { kind: 'parley', title: '先問他寫錯了哪條罪名', description: '拖住對方的怒氣並逼他說出真正來意；若談不開，至少讓圍觀者知道誰先拔劍。' }, '照本門拆帖法接下戰帖'],
  '客戶說路上很安全': [{ kind: 'bargain', title: '當街重談這只木匣的價錢', description: '風險已經現形，酬金也該跟著長；談成能補銀兩，談不成連原價都可能倒貼。' }, { kind: 'trick', title: '把空匣往另一條巷子送', description: '用鏢局雜物做一個假目標，成功便拆散伏兵，失手會讓自己先暴露。' }, '以本門手法試出木匣機關'],
  '英雄沒有船票折扣': [{ kind: 'protect', title: '先把乘客壓到船艙下', description: '你與船夫封住艙門，讓河盜只能先面對你；人情會留下，退路則不會。' }, { kind: 'force', title: '沿著鉤索反登賊船', description: '趁河盜還在拉繩時把戰場送回去，成了能奪先手，失敗就會濕著回來。' }, '踩船舷走一遍本門步法'],
  '說書人把你講成三百回': [{ kind: 'parley', title: '請說書人先講完敗筆那回', description: '主動承認故事裡最不好看的地方，削掉挑戰者借名聲起鬨的力道。' }, { kind: 'force', title: '把桌椅排成真正的擂台', description: '既然躲不過驗證，就把規矩與見證人都擺明；贏得漂亮會留下名聲。' }, '用本門真招刪掉兩百九十九回'],
  '漏雨的房也有人催租': [{ kind: 'protect', title: '先把藥箱塞回寡婦懷裡', description: '你站在門與病人之間，讓這筆租先找上自己；朋友與街坊會記得。' }, { kind: 'bargain', title: '拿漏水被褥抵掉半月房錢', description: '把自然景觀折算成實際損失，談成能保住藥箱，談崩就得賠上一筆。' }, '借屋樑施展本門守勢'],
  '這場訪談沒有最後一題': [{ kind: 'study', title: '重問一遍那些過分精準的問題', description: '從問題順序推回埋伏安排，讓訪談者自己暴露誰準備先動。' }, { kind: 'trick', title: '把墨水潑向桌下短刃', description: '用一團黑色先標出所有藏兵器的位置；若判斷失手，你只會得到一件髒衣服。' }, '用本門架勢回答最後一題'],
  '你的名號已被別人買走': [{ kind: 'bargain', title: '逐件估算假貨欠你的分成', description: '拿商會自己的帳目逼管事重談；成功可追回銀兩，失敗仍得付驗契費。' }, { kind: 'parley', title: '請買過假貨的人當場試用', description: '讓護身符自己證明有沒有用，將商會的體面變成你的開場護體。' }, '用本門真招驗明名號正身'],
  '舊友說這不是借錢': [{ kind: 'protect', title: '先替舊友家人解開繩索', description: '把最不能承受的代價先移開；成功會深化交情，也讓你獨自承受第一輪壓力。' }, { kind: 'bargain', title: '把債拆成能活著還的期數', description: '用自己的名聲替舊友爭取喘息，談成能保人，談崩便要付出現銀。' }, '用本門規矩替舊友作保'],
  '年輕人想替江湖換榜': [{ kind: 'study', title: '請他先演一遍所謂的新招', description: '讓新秀把銳氣展示完整，再從漂亮動作裡找出不願承認的空隙。' }, { kind: 'parley', title: '把榜單留給他，把山路留下', description: '試著拆開名次與活路；談成能省力，談不成也會讓旁人聽見你的條件。' }, '以本門老架子壓住新劍'],
  '最後一份委託沒有酬金': [{ kind: 'protect', title: '先帶孩子走過沒有火的路', description: '把村民集中到安全處，再回頭守住入口；這份人情沒有價碼，但有人會留下。' }, { kind: 'force', title: '直接去村口叫出舊仇名字', description: '讓搜村變成只對著你的一場舊帳，成功能奪回主動，失敗便帶傷起手。' }, '把一生所學擺在村口'],
  '那個人又來了': [{ kind: 'parley', title: '請他只算你真的做過的帳', description: '把傳聞與舊怨逐筆拆開，若能說動旁人，宿敵就少一層氣勢可借。' }, { kind: 'force', title: '當眾承認就是看他不順眼', description: '不再替這場重逢找藉口，直接拿氣勢與芥蒂換一個更強的開局。' }, '用他最熟的本門起手回敬'],
  '名聲總會帶人回來': [{ kind: 'study', title: '從那壺舊酒回想他的習慣', description: '把多年交手留下的細節重新拼起來；看得準能深化造詣，看錯就只是懷舊。' }, { kind: 'parley', title: '請他先說贏了以後要什麼', description: '逼宿敵承認這場勝負真正想換取的東西，讓旁人不再只替你們叫好。' }, '用本門如今的路數改寫舊招'],
};

const kindRules: Record<ChoiceKind, { check: LifeChoice['check']; success: LifeEffect[]; failure: LifeEffect[]; successPrep: BattlePreparation; failurePrep: BattlePreparation; growth: StatKey }> = {
  study: { check: { primary: 'wisdom', secondary: 'will' }, success: [{ type: 'resource', resource: 'proficiency', amount: 12 }, { type: 'resource', resource: 'qi', amount: 6 }], failure: [{ type: 'resource', resource: 'qi', amount: 2 }], successPrep: { guard: 8 }, failurePrep: {}, growth: 'wisdom' },
  bargain: { check: { primary: 'luck', secondary: 'wisdom' }, success: [{ type: 'resource', resource: 'money', amount: 10 }, { type: 'resource', resource: 'reputation', amount: 1 }], failure: [{ type: 'resource', resource: 'money', amount: -2 }], successPrep: { defense: 2 }, failurePrep: {}, growth: 'luck' },
  protect: { check: { primary: 'will', secondary: 'agility' }, success: [{ type: 'resource', resource: 'bond', amount: 2 }, { type: 'resource', resource: 'friendship', amount: 2 }, { type: 'resource', resource: 'hp', amount: 10 }], failure: [{ type: 'resource', resource: 'bond', amount: 1 }, { type: 'resource', resource: 'friendship', amount: 1 }], successPrep: { guard: 12, inviteFriend: true }, failurePrep: { inviteFriend: true }, growth: 'will' },
  force: { check: { primary: 'strength', secondary: 'constitution' }, success: [{ type: 'resource', resource: 'reputation', amount: 2 }], failure: [{ type: 'resource', resource: 'hp', amount: -6 }], successPrep: { attack: 3 }, failurePrep: { attack: 1 }, growth: 'strength' },
  trick: { check: { primary: 'agility', secondary: 'luck' }, success: [{ type: 'resource', resource: 'qi', amount: 5 }], failure: [], successPrep: { speed: 3, guard: 6, enemyAttack: -1 }, failurePrep: {}, growth: 'agility' },
  parley: { check: { primary: 'will', secondary: 'wisdom' }, success: [{ type: 'resource', resource: 'reputation', amount: 1 }, { type: 'resource', resource: 'rivalry', amount: -1 }], failure: [{ type: 'resource', resource: 'rivalry', amount: 1 }], successPrep: { guard: 10 }, failurePrep: {}, growth: 'will' },
};

function authoredChoice(event: Omit<LifeEvent, 'choices'>, authored: AuthoredChoice, suffix: string, sourceLabel?: string, availability: ChoiceAvailability = { type: 'always' }, commitEffects: LifeEffect[] = []): LifeChoice {
  const rule = kindRules[authored.kind];
  return { id: `${event.id}:${suffix}`, title: authored.title, description: authored.description, sourceLabel, check: rule.check, tags: [authored.kind], availability, commitEffects, successEffects: rule.success, failureEffects: rule.failure, battlePreparation: { success: rule.successPrep, failure: rule.failurePrep }, growthStat: rule.growth, feedback: { successHeadline: `${authored.title}，這一步算準了。`, failureHeadline: `${authored.title}，事情沒有照你想的走。`, successBridge: `你的準備改變了開局；${event.enemyName}仍舊沒有收起兵器。`, failureBridge: `準備沒有站穩，${event.enemyName}已經把距離逼近。`, successAction: '帶著成果迎戰 →', failureAction: '收拾失算迎戰 →' } };
}

function conditionalChoice(run: LifeRun, event: Omit<LifeEvent, 'choices'>, fallbackTitle: string): LifeChoice {
  const candidates = [
    run.friendship >= 3 ? () => authoredChoice(event, { kind: 'protect', title: `請${run.friendName}替你補上空位`, description: `你們已有足夠交情，不必臨場解釋每個眼色；代價是把朋友也放進這場風險。` }, 'friend', `與${run.friendName}交情 ${run.friendship}`, { type: 'friendship', minimum: 3 }) : null,
    run.rivalry >= 2 ? () => authoredChoice(event, { kind: 'force', title: `拿${run.rivalName}教過你的痛處試一次`, description: `你把多年芥蒂變成一個具體判斷；成功是經驗，失敗則只是又添一筆。` }, 'rival', `與${run.rivalName}芥蒂 ${run.rivalry}`, { type: 'rivalry', minimum: 2 }) : null,
    run.injury >= 1 ? () => authoredChoice(event, { kind: 'parley', title: '先替舊傷留一條退路', description: '你不再假裝身體沒有記性，改用位置與節奏保住最容易再裂開的地方。' }, 'injury', `舊傷 ${run.injury}`, { type: 'injury', minimum: 1 }) : null,
    run.money >= 8 ? () => authoredChoice(event, { kind: 'bargain', title: '花六文請熟路人先佈置退路', description: '這不是買勝利，只是花錢讓最糟的開局少一點；無論成敗，銀兩都不會自己走回來。' }, 'money', `持有銀兩 ${run.money}`, { type: 'money', minimum: 8 }, [{ type: 'resource', resource: 'money', amount: -6 }]) : null,
  ];
  const offset = hash(`choice-hook:${event.id}`) % candidates.length;
  for (let index = 0; index < candidates.length; index += 1) { const candidate = candidates[(offset + index) % candidates.length]; if (candidate) return candidate(); }
  return authoredChoice(event, { kind: 'study', title: fallbackTitle, description: `眼前沒有多餘人情或銀兩可借，你只能把${sectFor(run.sectId).name}練過的東西放進這個具體場合。` }, 'sect', `因為你是${sectFor(run.sectId).name}弟子`, { type: 'sect', sectId: sectFor(run.sectId).id });
}

type SliceChoiceOptions = {
  commit?: LifeEffect[];
  success?: LifeEffect[];
  failure?: LifeEffect[];
  successPrep?: BattlePreparation;
  failurePrep?: BattlePreparation;
  resolution?: 'battle' | 'peaceful';
  guaranteed?: boolean;
  encounter?: LifeChoice['encounter'];
  sourceLabel?: string;
};

function sliceChoice(event: Omit<LifeEvent, 'choices'>, authored: AuthoredChoice, suffix: string, options: SliceChoiceOptions = {}): LifeChoice {
  const base = authoredChoice(event, authored, suffix, options.sourceLabel);
  return {
    ...base,
    check: options.guaranteed ? null : base.check,
    commitEffects: [...base.commitEffects, ...(options.commit ?? [])],
    successEffects: [...base.successEffects, ...(options.success ?? [])],
    failureEffects: [...base.failureEffects, ...(options.failure ?? [])],
    battlePreparation: {
      success: { ...base.battlePreparation.success, ...options.successPrep },
      failure: { ...base.battlePreparation.failure, ...options.failurePrep },
    },
    resolution: options.resolution ?? 'battle',
    encounter: options.encounter,
  };
}

function verticalSliceEventFor(run: LifeRun): LifeEvent | null {
  if (run.turn > 2) return null;
  const duel: EncounterObjective = { id: 'duel', label: '正式決鬥', description: '一對一按規矩分勝負；練過什麼，台上就剩什麼。', enemyRole: 'warrior', enemyCount: 1 };
  const contract: EncounterObjective = { id: 'ambush', label: '保住貨與酬金', description: '差事不是決鬥；情報、人手和退路都能改寫敵人數量。', enemyRole: 'assassin', enemyCount: 2 };
  const protect: EncounterObjective = { id: 'protect', label: '護送撤離', description: '不是打倒最多人，而是讓被追的人先離開巷口。', enemyRole: 'assassin', enemyCount: 2 };

  if (run.turn === 0) {
    const event = { id: 'slice-crossroads', title: '三條路，只夠走一條', place: '山門外的早市', lead: `你剛入${sectFor(run.sectId).name}，同一個早晨便有三件事找上門：教習遞來決鬥木牌，牙行拿來一張有酬差事，送信人${run.friendName}則被追兵堵在藥攤後。`, conflict: '你只能先承擔其中一件事；選下的方法會決定接下來兩回合誰來找你、你為什麼動手，以及銀兩能不能替你買到別的解法。', weather: '晴' as const, objective: duel, enemyName: '試招弟子', enemyRole: 'warrior' as const, enemyCount: 1 };
    return { ...event, choices: [
      sliceChoice(event, { kind: 'study', title: '接下木牌，先練再打', description: '把三天都押在同一場正式決鬥上；造詣與名聲會長，退路則會變少。' }, 'train', { commit: [{ type: 'path', path: 'duelist' }], success: [{ type: 'flag', flag: 'studied-opponent' }], encounter: { title: '決鬥前的試招', conflict: '教習要求你先與試招弟子過手；這不是街頭衝突，而是正式決鬥的第一道門。', objective: duel, enemyName: '試招弟子', enemyRole: 'warrior', enemyCount: 1 } }),
      sliceChoice(event, { kind: 'bargain', title: '接下差事，先問清酬金', description: '替牙行送一只封箱；這條路會賺錢，也會逼你決定情報、人手和安全各值多少。' }, 'work', { commit: [{ type: 'path', path: 'contractor' }, { type: 'resource', resource: 'money', amount: 12 }], success: [{ type: 'resource', resource: 'money', amount: 4 }], encounter: { title: '第一趟有酬差事', conflict: '封箱才離牙行就有人跟上；你得先保住貨，下一趟才有本錢買情報或人手。', objective: contract, enemyName: '盯梢腳夫', enemyRole: 'assassin', enemyCount: 1 } }),
      sliceChoice(event, { kind: 'protect', title: `先把${run.friendName}送出巷口`, description: '放下木牌與酬金，護住眼前的人；追兵不會消失，但這個人會在下一回合帶消息回來。' }, 'help', { commit: [{ type: 'path', path: 'protector' }], success: [{ type: 'flag', flag: 'protected-courier' }], encounter: { title: '先把人送出去', conflict: `追兵已認出${run.friendName}手裡的信袋；你必須擋住巷口，讓送信人先撤。`, objective: protect, enemyName: '截信追兵', enemyRole: 'assassin', enemyCount: 2 } }),
    ] };
  }

  if (run.lifePath === 'duelist') {
    const studied = run.sliceFlags.includes('studied-opponent');
    const event = { id: `slice-duelist-${run.turn}`, title: run.turn === 1 ? '木牌已經掛上擂台' : '三日後，正式決鬥', place: '山門演武場', lead: run.turn === 1 ? `${studied ? '你從昨日試招記住了對方收肩的習慣。' : '昨日的試招沒有留下漂亮答案。'}教習今天讓你選：繼續拆招、公開立約，或先把身體調回來。` : `${studied ? '你曾先看過他的起手，今日那個細節仍在。' : '你沒有額外線索，只能相信這兩日的選擇。'}擂台四周已站滿同門，正式決鬥沒有再延期的欄位。`, conflict: '決鬥已由雙方具名立約；退場會失去這條以武求名的路，現在只能用你準備出的打法完成它。', weather: '晴' as const, objective: duel, enemyName: run.turn === 1 ? '陪練師兄' : '木牌對手', enemyRole: 'warrior' as const, enemyCount: 1 };
    return { ...event, choices: [
      sliceChoice(event, { kind: 'study', title: '沿著收肩破綻再拆十遍', description: '把先前觀察變成可重複的起手；這條路最穩定地累積造詣。' }, 'study', { success: [{ type: 'flag', flag: 'studied-opponent' }], successPrep: { attack: 2 } }),
      sliceChoice(event, { kind: 'force', title: '把勝負寫進公開木牌', description: '用名聲換壓力，逼自己在眾人面前完成這條路。' }, 'vow', { successPrep: { attack: 4 }, failurePrep: { enemyAttack: 2 } }),
      sliceChoice(event, { kind: 'parley', title: '請醫館先驗傷再開打', description: '承認身體也是決鬥規則的一部分；少一點氣勢，換更長的續航。' }, 'recover', { success: [{ type: 'resource', resource: 'hp', amount: 16 }], successPrep: { guard: 12 } }),
    ] };
  }

  if (run.lifePath === 'contractor') {
    const permit = run.sliceFlags.includes('bought-permit');
    const event = { id: `slice-contractor-${run.turn}`, title: run.turn === 1 ? '第二趟之前，先算成本' : '牙行終於肯結帳', place: run.turn === 1 ? '驛站後院' : '牙行帳房', lead: run.turn === 1 ? '第一趟讓你知道，差事的危險不只在刀上。驛站販子把三種價格寫在木板上：情報五文、人手九文、官道通行文書十二文。' : `${permit ? '因為你買了通行文書，第二趟沒有開打，貨也準時到了。' : run.sliceFlags.includes('hired-help') ? '你僱來的人手替你守住後路，牙行因此少了一個賴帳理由。' : run.sliceFlags.includes('bought-intel') ? '你買的情報讓伏兵少了一半，剩下的麻煩如今寫在帳上。' : '你省下現銀，卻把風險全留給自己。'}現在掌櫃攤開酬金與損耗，要你選怎麼收尾。`, conflict: run.turn === 1 ? '若不買任何準備，就得照原路穿過兩處伏點；這一次，銀兩可以真實減少敵人、帶來幫手，或直接買掉整場戰鬥。' : '掌櫃想扣下尾款，護院已站到門口；你可以接受一筆乾淨的結算，也可以為更多錢承擔最後一場風險。', weather: '風' as const, objective: contract, enemyName: '截貨伏兵', enemyRole: 'assassin' as const, enemyCount: 2 };
    if (run.turn === 1) return { ...event, choices: [
      sliceChoice(event, { kind: 'study', title: '花五文買伏點情報', description: '情報會把兩處伏點縮成一處，並降低敵人的第一輪攻勢。' }, 'intel', { guaranteed: true, commit: [{ type: 'resource', resource: 'money', amount: -5 }, { type: 'flag', flag: 'bought-intel' }], successPrep: { enemyAttack: -3, guard: 8 }, encounter: { enemyCount: 1 } }),
      sliceChoice(event, { kind: 'protect', title: '花九文僱一名熟路人', description: '你不是買傷害，而是買一個會替最弱的人補位、治傷與守後路的同伴。' }, 'hire', { guaranteed: true, commit: [{ type: 'resource', resource: 'money', amount: -9 }, { type: 'flag', flag: 'hired-help' }], successPrep: { inviteFriend: true }, sourceLabel: `現銀 ${run.money}` }),
      sliceChoice(event, { kind: 'bargain', title: '花十二文買官道通行文書', description: '文書不提高勝率；它把這一回合的伏擊整段移除，直接保住貨與氣血。' }, 'permit', { guaranteed: true, resolution: 'peaceful', commit: [{ type: 'resource', resource: 'money', amount: -12 }, { type: 'flag', flag: 'bought-permit' }], success: [{ type: 'resource', resource: 'reputation', amount: 1 }] }),
    ] };
    return { ...event, choices: [
      sliceChoice(event, { kind: 'bargain', title: '照憑據收下乾淨尾款', description: '不再加碼風險；把前兩回合留下的證據換成確定銀兩。' }, 'settle', { guaranteed: true, resolution: 'peaceful', success: [{ type: 'resource', resource: 'money', amount: permit ? 16 : 12 }] }),
      sliceChoice(event, { kind: 'parley', title: '把扣款逐條念給所有夥計聽', description: '用公開帳目追回名聲與尾款；談不攏，護院便會動手。' }, 'audit', { success: [{ type: 'resource', resource: 'money', amount: 14 }], encounter: { title: '帳房前的最後交涉', enemyName: '牙行護院', enemyRole: 'tank', enemyCount: 1, objective: { id: 'siege', label: '追回尾款', description: '護院很硬，帳也很硬；打開其中一個就能結算。', enemyRole: 'tank', enemyCount: 1 } } }),
      sliceChoice(event, { kind: 'force', title: '接下更貴也更髒的下一單', description: '立刻拿預付金，代價是用一場硬仗證明你接得住。' }, 'advance', { commit: [{ type: 'resource', resource: 'money', amount: 8 }], successPrep: { attack: 3 }, encounter: { title: '預付金後的驗貨', enemyName: '黑市驗貨人', enemyRole: 'warrior', enemyCount: 2 } }),
    ] };
  }

  if (run.lifePath === 'protector') {
    const protectedCourier = run.sliceFlags.includes('protected-courier');
    const evacuated = run.sliceFlags.includes('evacuated-neighbors');
    const event = { id: `slice-protector-${run.turn}`, title: run.turn === 1 ? `${run.friendName}帶著回報回來` : '被救的人記得那條路', place: run.turn === 1 ? '藥鋪後門' : '南城渡口', lead: run.turn === 1 ? `${run.friendName}${protectedCourier ? '平安送出信後' : '帶著裂開的信袋'}折回藥鋪，說追兵真正要找的是住在南巷的三戶證人。你昨天護住一個人，今天得決定怎麼把更多人撤出去。` : `${run.friendName}回報：${evacuated ? '南巷三戶已沿你清出的路抵達渡口，追兵只剩最後一隊。' : '有人撤得太慢，最後一隊追兵已追到渡口。'}同一個人、同一封信，現在成了你們共同承擔的後果。`, conflict: '追兵的目標是攔人滅口；勝負不只看你站著沒有，也看你是否先把撤離路線守住。', weather: '雨' as const, objective: protect, enemyName: '滅口追兵', enemyRole: 'assassin' as const, enemyCount: 2 };
    return { ...event, choices: [
      sliceChoice(event, { kind: 'protect', title: `讓${run.friendName}領人先走`, description: '你守最窄的巷口，把撤離交給已經信任你的人；成功會留下可追溯的人情與交情。' }, 'evacuate', { success: [{ type: 'flag', flag: 'evacuated-neighbors' }, { type: 'resource', resource: 'friendship', amount: 2 }], successPrep: { guard: 14, inviteFriend: true }, encounter: { objective: { id: 'escape', label: '守住撤離時間', description: '撐住追兵，讓街坊先過渡口。', enemyRole: 'assassin', enemyCount: 2 } } }),
      sliceChoice(event, { kind: 'trick', title: '把空信袋分送三條巷子', description: '用假目標拆散追兵；成功會少一名敵人，失敗則讓撤離更急。' }, 'decoy', { successPrep: { speed: 3 }, encounter: { enemyCount: 1 } }),
      sliceChoice(event, { kind: 'parley', title: '帶證人直接去找巡檢', description: '把私人追殺變成公開案子；規矩未必可靠，但公開本身會改變對手的成本。' }, 'witness', { success: [{ type: 'resource', resource: 'reputation', amount: 2 }], successPrep: { enemyAttack: -2, guard: 8 } }),
    ] };
  }
  return null;
}

export function eventFor(run: LifeRun): LifeEvent {
  const slice = verticalSliceEventFor(run);
  if (slice) return slice;
  const event = baseEventFor(run);
  const copy = eventChoiceCopy[event.title];
  const [first, second, fallback] = copy ?? [{ kind: 'trick', title: `繞著${event.enemyName}找空位`, description: '先讓眼前局勢露出一個可以利用的角度。' }, { kind: 'force', title: `正面接下${event.enemyName}`, description: '不再等待局勢自己變好，直接決定第一步。' }, `按本門步法站穩`] as [AuthoredChoice, AuthoredChoice, string];
  return { ...event, choices: [authoredChoice(event, first, 'a'), authoredChoice(event, second, 'b'), conditionalChoice(run, event, fallback)] };
}

function enemyActor(run: LifeRun, event: LifeEvent, index: number, attackDelta = 0): BattleActor {
  const scale = Math.max(1, 1 + Math.floor(run.turn / 2) + index + difficultyFor(run.difficulty).enemyScale);
  const hp = 38 + scale * 13;
  return { id: `enemy-${index}`, name: index ? `${event.enemyName}同夥` : event.enemyName, role: event.enemyRole, side: 'enemy', hp, maxHp: hp, qi: 18 + scale * 2, maxQi: 18 + scale * 2, attack: 8 + scale * 3 + attackDelta + (hasTalent(run, '運氣不太好') ? 2 : 0), defense: 3 + Math.floor(scale / 2), guard: 0, progress: 0, baseSpeed: event.enemyRole === 'assassin' ? 13 : event.enemyRole === 'tank' ? 7 : 10, speed: event.enemyRole === 'assassin' ? 13 : event.enemyRole === 'tank' ? 7 : 10, actionsTaken: 0, actionIds: [event.enemyRole === 'assassin' ? 'enemy-assassin' : event.enemyRole === 'tank' ? 'enemy-guard' : 'enemy-strike'], passiveIds: [] };
}

function friendActor(run: LifeRun): BattleActor {
  const hp = 48 + run.stats.constitution * 5 + run.friendship * 2;
  return { id: 'friend', name: run.friendName, role: 'healer', side: 'ally', hp, maxHp: hp, qi: 18 + run.friendship, maxQi: 18 + run.friendship, attack: 7 + Math.floor(run.friendship / 2), defense: 3 + Math.floor(run.friendship / 3), guard: 0, progress: 0, baseSpeed: 8 + Math.floor(run.stats.agility / 2), speed: 8 + Math.floor(run.stats.agility / 2), actionsTaken: 0, actionIds: ['friend-help', 'friend-strike'], passiveIds: [] };
}

export type InsightDefinition = { id: InsightId; sectId: SectId; tier: 1 | 2 | 3; name: string; description: string; moveId: string; apply: (action: BattleActionDefinition) => BattleActionDefinition };
export const insightThresholds = [35, 85, 145] as const;
const tuneEffect = (action: BattleActionDefinition, type: BattleActionDefinition['effects'][number]['type'], values: Record<string, number>): BattleActionDefinition => ({ ...action, effects: action.effects.map((effect) => effect.type === type ? { ...effect, ...values } as typeof effect : effect) });
const addEffect = (action: BattleActionDefinition, effect: BattleActionDefinition['effects'][number]): BattleActionDefinition => ({ ...action, effects: [...action.effects, effect] });
const insight = (id: InsightId, sectId: SectId, tier: 1 | 2 | 3, name: string, description: string, moveId: string, apply: InsightDefinition['apply']): InsightDefinition => ({ id, sectId, tier, name, description, moveId, apply });
export const insightDefinitions: InsightDefinition[] = [
  insight('huashan-1-a', 'huashan', 1, '劍走連環', '起手式每次累積劍式 2 層。', 'huashan-start', (action) => tuneEffect(action, 'apply-status', { stacks: 2 })),
  insight('huashan-1-b', 'huashan', 1, '藏鋒入鞘', '收劍調息回內力 18、護體 12。', 'huashan-breath', (action) => tuneEffect(tuneEffect(action, 'restore-qi', { amount: 18 }), 'guard', { amount: 12 })),
  insight('huashan-2-a', 'huashan', 2, '破勢見骨', '破雲一線每層劍式追加傷害提高至 17。', 'huashan-break', (action) => tuneEffect(action, 'consume-status-damage', { damagePerStack: 17 })),
  insight('huashan-2-b', 'huashan', 2, '回風有憑', '回風守勢反擊 18，化解下次傷害 55%。', 'huashan-screen', (action) => tuneEffect(tuneEffect(action, 'counter', { damage: 18 }), 'reduce-next-hit', { percent: .55 })),
  insight('huashan-3-a', 'huashan', 3, '一線無滯', '破雲一線內力消耗降至 8。', 'huashan-break', (action) => ({ ...action, qiCost: 8 })),
  insight('huashan-3-b', 'huashan', 3, '長風不息', '回風守勢反擊 23，化解下次傷害 65%。', 'huashan-screen', (action) => tuneEffect(tuneEffect(action, 'counter', { damage: 23 }), 'reduce-next-hit', { percent: .65 })),
  insight('shaolin-1-a', 'shaolin', 1, '掌下生根', '伏虎掌獲得護體 14。', 'shaolin-palm', (action) => tuneEffect(action, 'guard', { amount: 14 })),
  insight('shaolin-1-b', 'shaolin', 1, '坐忘深息', '坐忘回血 24、回內力 12。', 'shaolin-meditate', (action) => tuneEffect(tuneEffect(action, 'heal', { amount: 24 }), 'restore-qi', { amount: 12 })),
  insight('shaolin-2-a', 'shaolin', 2, '鐘鳴省力', '金鐘撞內力消耗降至 10。', 'shaolin-bell', (action) => ({ ...action, qiCost: 10 })),
  insight('shaolin-2-b', 'shaolin', 2, '明王受身', '不動明王護體 32，化解下次傷害 65%。', 'shaolin-stance', (action) => tuneEffect(tuneEffect(action, 'guard', { amount: 32 }), 'reduce-next-hit', { percent: .65 })),
  insight('shaolin-3-a', 'shaolin', 3, '鐘掌相應', '金鐘撞傷害倍率 1.7，並獲得護體 24。', 'shaolin-bell', (action) => tuneEffect(tuneEffect(action, 'damage', { multiplier: 1.7 }), 'guard', { amount: 24 })),
  insight('shaolin-3-b', 'shaolin', 3, '久戰不退', '伏虎掌護體 18，另化解下次傷害 20%。', 'shaolin-palm', (action) => addEffect(tuneEffect(action, 'guard', { amount: 18 }), { type: 'reduce-next-hit', percent: .2, recipient: 'actor' })),
  insight('wudang-1-a', 'wudang', 1, '雲手留隙', '雲手令目標下次受擊增加 30%。', 'wudang-cloud', (action) => tuneEffect(action, 'expose-next-hit', { percent: .3 })),
  insight('wudang-1-b', 'wudang', 1, '太和長息', '太和吐納回血 18、回內力 17。', 'wudang-breath', (action) => tuneEffect(tuneEffect(action, 'heal', { amount: 18 }), 'restore-qi', { amount: 17 })),
  insight('wudang-2-a', 'wudang', 2, '借力留勁', '借力打力消耗 8，化解下次傷害 50%。', 'wudang-turn', (action) => tuneEffect({ ...action, qiCost: 8 }, 'reduce-next-hit', { percent: .5 })),
  insight('wudang-2-b', 'wudang', 2, '圓轉成環', '圓轉如意反擊 23、護體 18。', 'wudang-circle', (action) => tuneEffect(tuneEffect(action, 'counter', { damage: 23 }), 'guard', { amount: 18 })),
  insight('wudang-3-a', 'wudang', 3, '勢不落空', '雲手令目標下次受擊增加 42%。', 'wudang-cloud', (action) => tuneEffect(action, 'expose-next-hit', { percent: .42 })),
  insight('wudang-3-b', 'wudang', 3, '卸盡來勢', '借力打力化解下次傷害 68%。', 'wudang-turn', (action) => tuneEffect(action, 'reduce-next-hit', { percent: .68 })),
  insight('beggar-1-a', 'beggar', 1, '棒影追身', '打狗棒影傷害倍率提高至 1.22。', 'beggar-stick', (action) => tuneEffect(action, 'damage', { multiplier: 1.22 })),
  insight('beggar-1-b', 'beggar', 1, '濁酒暖身', '一口濁酒回血 21、回內力 14。', 'beggar-wine', (action) => tuneEffect(tuneEffect(action, 'heal', { amount: 21 }), 'restore-qi', { amount: 14 })),
  insight('beggar-2-a', 'beggar', 2, '百家借勁', '百家一棍消耗 9，回內力 8。', 'beggar-wave', (action) => tuneEffect({ ...action, qiCost: 9 }, 'restore-qi', { amount: 8 })),
  insight('beggar-2-b', 'beggar', 2, '巷口熟路', '巷口步護體 22、反擊 17。', 'beggar-footwork', (action) => tuneEffect(tuneEffect(action, 'guard', { amount: 22 }), 'counter', { damage: 17 })),
  insight('beggar-3-a', 'beggar', 3, '眾聲成棍', '百家一棍傷害倍率提高至 1.75。', 'beggar-wave', (action) => tuneEffect(action, 'damage', { multiplier: 1.75 })),
  insight('beggar-3-b', 'beggar', 3, '棍去氣回', '打狗棒影每次命中回內力 4。', 'beggar-stick', (action) => addEffect(action, { type: 'restore-qi', amount: 4, recipient: 'actor' })),
  insight('emei-1-a', 'emei', 1, '點穴入微', '拂塵點穴令目標下次受擊增加 35%。', 'emei-needle', (action) => tuneEffect(action, 'expose-next-hit', { percent: .35 })),
  insight('emei-1-b', 'emei', 1, '藥到心定', '靜心敷藥回血提高至 30。', 'emei-medicine', (action) => tuneEffect(action, 'heal', { amount: 30 })),
  insight('emei-2-a', 'emei', 2, '月影雙封', '月影封脈消耗 9，施加毒性 2 層。', 'emei-moon', (action) => tuneEffect({ ...action, qiCost: 9 }, 'apply-status', { stacks: 2 })),
  insight('emei-2-b', 'emei', 2, '清規有鋒', '清規攔人護體 20、反擊 21。', 'emei-parry', (action) => tuneEffect(tuneEffect(action, 'guard', { amount: 20 }), 'counter', { damage: 21 })),
  insight('emei-3-a', 'emei', 3, '封脈追月', '月影封脈傷害倍率提高至 1.58。', 'emei-moon', (action) => tuneEffect(action, 'damage', { multiplier: 1.58 })),
  insight('emei-3-b', 'emei', 3, '一針留路', '拂塵點穴令目標下次受擊增加 48%。', 'emei-needle', (action) => tuneEffect(action, 'expose-next-hit', { percent: .48 })),
  insight('tang-1-a', 'tang', 1, '細雨成霧', '細雨針每次施加毒性 2 層。', 'tang-needle', (action) => tuneEffect(action, 'apply-status', { stacks: 2 })),
  insight('tang-1-b', 'tang', 1, '以毒續脈', '以毒養氣回血 21、回內力 14。', 'tang-antidote', (action) => tuneEffect(tuneEffect(action, 'heal', { amount: 21 }), 'restore-qi', { amount: 14 })),
  insight('tang-2-a', 'tang', 2, '梨花收網', '暴雨梨花消耗 9，每層毒追加傷害 22。', 'tang-bloom', (action) => tuneEffect({ ...action, qiCost: 9 }, 'consume-status-damage', { damagePerStack: 22 })),
  insight('tang-2-b', 'tang', 2, '迷煙藏身', '迷煙退場護體 25、反擊 15。', 'tang-smoke', (action) => tuneEffect(tuneEffect(action, 'guard', { amount: 25 }), 'counter', { damage: 15 })),
  insight('tang-3-a', 'tang', 3, '毒盡花開', '暴雨梨花每層毒追加傷害 27，傷害倍率 1.38。', 'tang-bloom', (action) => tuneEffect(tuneEffect(action, 'consume-status-damage', { damagePerStack: 27 }), 'damage', { multiplier: 1.38 })),
  insight('tang-3-b', 'tang', 3, '煙後有針', '細雨針傷害倍率 1.08，仍會深化毒性。', 'tang-needle', (action) => tuneEffect(action, 'damage', { multiplier: 1.08 })),
];

export function nextInsightTier(run: Pick<LifeRun, 'proficiency' | 'insights'>): 1 | 2 | 3 | null {
  for (let index = 0; index < insightThresholds.length; index += 1) if (run.proficiency >= insightThresholds[index] && !run.insights.some((id) => id.includes(`-${index + 1}-`))) return (index + 1) as 1 | 2 | 3;
  return null;
}
export function insightChoicesFor(run: Pick<LifeRun, 'sectId' | 'proficiency' | 'insights'>) {
  const tier = nextInsightTier(run);
  return tier && run.sectId ? insightDefinitions.filter((item) => item.sectId === run.sectId && item.tier === tier) : [];
}
export function chooseInsight(run: LifeRun, insightId: InsightId): LifeRun {
  const option = insightDefinitions.find((item) => item.id === insightId);
  const tier = nextInsightTier(run);
  if (!option || option.sectId !== run.sectId || option.tier !== tier) return run;
  return { ...run, insights: [...run.insights, insightId] };
}
export function resolvedSectFor(run: Pick<LifeRun, 'sectId' | 'insights'>): Sect {
  const base = sectFor(run.sectId);
  return { ...base, moves: base.moves.map((move) => {
    const action = run.insights.map((id) => insightDefinitions.find((item) => item.id === id)).filter((item): item is InsightDefinition => Boolean(item) && item!.moveId === move.id).reduce((current, item) => item.apply(current), move.action);
    return { ...move, qiCost: action.qiCost ?? 0, action };
  }) };
}

export function rulesFor(sect: Sect): BattleRules {
  const moves = Object.fromEntries(sect.moves.map((move) => [move.id, move.action]));
  return { actions: {
    ...moves,
    'enemy-strike': strike('enemy-strike', '迎面一擊', 'random-foe', 0, [{ type: 'damage', multiplier: 1 }]),
    'enemy-assassin': strike('enemy-assassin', '趁虛突刺', 'weakest-enemy', 4, [{ type: 'damage', multiplier: 1.22 }]),
    'enemy-guard': strike('enemy-guard', '穩守撞擊', 'random-foe', 0, [{ type: 'damage', multiplier: .86 }, { type: 'guard', amount: 8, recipient: 'actor' }]),
    'friend-help': strike('friend-help', '援手照應', 'weakest-ally', 7, [{ type: 'heal', amount: 14, recipient: 'target' }, { type: 'guard', amount: 7, recipient: 'target' }]),
    'friend-strike': strike('friend-strike', '趁隙出手', 'weakest-enemy', 0, [{ type: 'damage', multiplier: .86 }]),
  }, passives: {}, speedModifiers: [], damageModifiers: [] };
}

function applyLifeEffects(run: LifeRun, effects: LifeEffect[]): LifeRun {
  const next = { ...run, sliceFlags: [...run.sliceFlags] };
  for (const effect of effects) {
    if (effect.type === 'path') { next.lifePath = effect.path; continue; }
    if (effect.type === 'flag') { if (!next.sliceFlags.includes(effect.flag)) next.sliceFlags.push(effect.flag); continue; }
    const amount = effect.amount;
    if (effect.resource === 'hp') next.hp = Math.max(1, Math.min(next.maxHp, next.hp + amount));
    else if (effect.resource === 'qi') next.qi = Math.max(0, Math.min(next.maxQi, next.qi + amount));
    else if (effect.resource === 'money') next.money = Math.max(0, next.money + amount);
    else if (effect.resource === 'proficiency') next.proficiency = Math.max(0, next.proficiency + amount);
    else if (effect.resource === 'reputation') next.reputation = Math.max(0, next.reputation + amount);
    else if (effect.resource === 'bond') next.bond = Math.max(0, next.bond + amount);
    else if (effect.resource === 'friendship') next.friendship = Math.max(0, next.friendship + amount);
    else next.rivalry = Math.max(0, next.rivalry + amount);
  }
  return next;
}

export type ShopItem = { id: ShopItemId; name: string; price: number; description: string; effect: string; bonus: 'attack' | 'defense' | 'guard' | 'maxHp' | 'maxQi'; amount: number };
export type UpgradeOffer = { id: UpgradeId; name: string; rarity: RarityId; description: string; effect: string; amount: number };
const upgradeDefinitions: Record<UpgradeId, { name: string; description: string; bonus: 'attack' | 'defense' | 'guard' | 'maxHp' | 'maxQi' | 'speed'; amounts: Record<RarityId, number> }> = {
  force: { name: '勁透兵刃', description: '每一次出手都更有份量。', bonus: 'attack', amounts: { common: 1, rare: 2, legendary: 4 } },
  armor: { name: '卸力成習', description: '身體記住如何少吃一點虧。', bonus: 'defense', amounts: { common: 1, rare: 2, legendary: 3 } },
  vitality: { name: '氣血綿長', description: '活得久一點，故事才有下句。', bonus: 'maxHp', amounts: { common: 8, rare: 15, legendary: 26 } },
  breath: { name: '周天不息', description: '招式之間，多留一口能用的氣。', bonus: 'maxQi', amounts: { common: 6, rare: 12, legendary: 20 } },
  'opening-guard': { name: '先守半步', description: '每場交手先替未來的自己擋一下。', bonus: 'guard', amounts: { common: 6, rare: 12, legendary: 20 } },
  footwork: { name: '步先意動', description: '更快走到下一次出手的位置。', bonus: 'speed', amounts: { common: 1, rare: 2, legendary: 3 } },
};
const upgradeRarityLabel: Record<RarityId, string> = { common: '普通', rare: '稀有', legendary: '傳說' };
function upgradeRarity(seed: string): RarityId { const roll = range(seed, 1, 100); return roll <= 60 ? 'common' : roll <= 90 ? 'rare' : 'legendary'; }
export function upgradeChoicesFor(run: LifeRun): UpgradeOffer[] {
  if (!run.pendingUpgrade) return [];
  const battleTurn = Math.max(0, run.turn - 1);
  const ids = (Object.keys(upgradeDefinitions) as UpgradeId[]).sort((left, right) => hash(`${run.seed}:upgrade:${battleTurn}:${left}`) - hash(`${run.seed}:upgrade:${battleTurn}:${right}`)).slice(0, 3);
  const rarities = ids.map((_, index) => upgradeRarity(`${run.seed}:upgrade-rarity:${battleTurn}:${index}`));
  if (new Set(rarities).size === 1) rarities[1] = rarities[0] === 'common' ? 'rare' : rarities[0] === 'rare' ? 'legendary' : 'rare';
  return ids.map((id, index) => { const definition = upgradeDefinitions[id]; const rarity = rarities[index]; const amount = definition.amounts[rarity]; const unit = definition.bonus === 'attack' ? '永久攻擊' : definition.bonus === 'defense' ? '永久防禦' : definition.bonus === 'guard' ? '每場起手護體' : definition.bonus === 'maxHp' ? '永久最大氣血' : definition.bonus === 'maxQi' ? '永久最大內力' : '永久速度'; return { id, name: definition.name, rarity, description: definition.description, effect: `${unit} +${amount}`, amount }; });
}
export function chooseBattleUpgrade(run: LifeRun, id: UpgradeId): LifeRun {
  const offer = upgradeChoicesFor(run).find((item) => item.id === id);
  if (!offer) return run;
  const definition = upgradeDefinitions[id];
  const next: LifeRun = { ...run, pendingUpgrade: false, upgrades: [...run.upgrades, { id, rarity: offer.rarity, acquiredAfterTurn: Math.max(0, run.turn - 1) }], chronicle: [...run.chronicle, `${run.year} · 戰後領悟 · ${upgradeRarityLabel[offer.rarity]}「${offer.name}」（${offer.effect}）。`] };
  if (definition.bonus === 'attack') next.shopAttack += offer.amount;
  if (definition.bonus === 'defense') next.shopDefense += offer.amount;
  if (definition.bonus === 'guard') next.shopGuard += offer.amount;
  if (definition.bonus === 'speed') next.upgradeSpeed += offer.amount;
  if (definition.bonus === 'maxHp') { next.shopMaxHp += offer.amount; next.maxHp += offer.amount; next.hp += offer.amount; }
  if (definition.bonus === 'maxQi') { next.shopMaxQi += offer.amount; next.maxQi += offer.amount; next.qi += offer.amount; }
  return next;
}
export function describeUpgrade(upgrade: BattleUpgrade) {
  const definition = upgradeDefinitions[upgrade.id]; const amount = definition.amounts[upgrade.rarity];
  const unit = definition.bonus === 'attack' ? '永久攻擊' : definition.bonus === 'defense' ? '永久防禦' : definition.bonus === 'guard' ? '每場起手護體' : definition.bonus === 'maxHp' ? '永久最大氣血' : definition.bonus === 'maxQi' ? '永久最大內力' : '永久速度';
  return { name: definition.name, rarity: upgrade.rarity, effect: `${unit} +${amount}` };
}
const stageShopItems: Record<LifePhase, ShopItem[]> = {
  少年: [
    { id: '少年-藥布', name: '藥鋪厚布', price: 6, description: '先把容易裂開的地方包好。', effect: '永久最大氣血 +10', bonus: 'maxHp', amount: 10 },
    { id: '少年-護腕', name: '舊皮護腕', price: 8, description: '不漂亮，但每場都先替你挨一下。', effect: '每場起手護體 +8', bonus: 'guard', amount: 8 },
    { id: '少年-吐納冊', name: '抄舊的吐納冊', price: 7, description: '前半本是口訣，後半本是欠款名單。', effect: '永久最大內力 +8', bonus: 'maxQi', amount: 8 },
  ],
  入門: [
    { id: '入門-練功樁', name: '短樁配重', price: 10, description: '背著很累，出手時比較不客氣。', effect: '永久攻擊 +2', bonus: 'attack', amount: 2 },
    { id: '入門-軟甲', name: '門派舊軟甲', price: 11, description: '前任主人升遷了，或者沒升。掌櫃不說。', effect: '永久防禦 +2', bonus: 'defense', amount: 2 },
    { id: '入門-行氣散', name: '行氣散', price: 8, description: '藥味很重，內力因此不敢偷懶。', effect: '永久最大內力 +10', bonus: 'maxQi', amount: 10 },
  ],
  闖蕩: [
    { id: '闖蕩-精鐵兵器', name: '精鐵兵器', price: 14, description: '終於有一件兵器不會先向你道歉。', effect: '永久攻擊 +3', bonus: 'attack', amount: 3 },
    { id: '闖蕩-鎖子內襯', name: '鎖子內襯', price: 15, description: '走路會響，至少倒下時比較安靜。', effect: '永久防禦 +3', bonus: 'defense', amount: 3 },
    { id: '闖蕩-還神丹', name: '還神丹', price: 12, description: '郎中保證不是糖，價錢也支持他的說法。', effect: '永久最大氣血 +16', bonus: 'maxHp', amount: 16 },
  ],
  成名: [
    { id: '成名-名匠兵器', name: '名匠重製', price: 18, description: '名匠刻了你的名字，也把價錢刻得很深。', effect: '永久攻擊 +4', bonus: 'attack', amount: 4 },
    { id: '成名-護心鏡', name: '護心鏡', price: 18, description: '保心口，不保名聲。', effect: '每場起手護體 +16', bonus: 'guard', amount: 16 },
    { id: '成名-小還丹', name: '小還丹', price: 16, description: '名字很小，帳很完整。', effect: '永久最大內力 +16', bonus: 'maxQi', amount: 16 },
  ],
  晚年: [
    { id: '晚年-舊兵重磨', name: '舊兵重磨', price: 16, description: '沒有換掉陪你一生的東西，只把鈍處承認一次。', effect: '永久攻擊 +3', bonus: 'attack', amount: 3 },
    { id: '晚年-鹿皮護膝', name: '鹿皮護膝', price: 14, description: '江湖不尊老，膝蓋至少可以。', effect: '永久防禦 +3', bonus: 'defense', amount: 3 },
    { id: '晚年-參丸', name: '參丸', price: 18, description: '把下一口氣先買下來。', effect: '永久最大氣血 +20', bonus: 'maxHp', amount: 20 },
  ],
};

export function shopItemsFor(run: LifeRun) { return stageShopItems[phaseForTurn(run.turn).name]; }
export function needsStageShop(run: LifeRun) { const phase = phaseForTurn(run.turn); return phase.start === run.turn && !run.visitedShops.includes(phase.name); }
export function canRecruitCompanion(run: LifeRun) { return run.turn >= phases.find((phase) => phase.name === '闖蕩')!.start && run.friendship >= 4 && !run.companionJoined; }
export function recruitCompanion(run: LifeRun): LifeRun {
  if (!canRecruitCompanion(run)) return run;
  return { ...run, companionJoined: true, chronicle: [...run.chronicle, `${run.year} · ${run.friendName}不再只來救場，正式與你同行。`] };
}
export function finishStageShop(run: LifeRun, itemId: ShopItemId | null): LifeRun {
  if (!needsStageShop(run)) return run;
  const phase = phaseForTurn(run.turn).name;
  const item = itemId ? shopItemsFor(run).find((candidate) => candidate.id === itemId) : null;
  if (itemId && (!item || run.money < item.price)) return run;
  const next: LifeRun = { ...run, visitedShops: [...run.visitedShops, phase], shopPurchases: item ? [...run.shopPurchases, item.id] : run.shopPurchases, money: run.money - (item?.price ?? 0) };
  if (!item) return next;
  if (item.bonus === 'attack') next.shopAttack += item.amount;
  if (item.bonus === 'defense') next.shopDefense += item.amount;
  if (item.bonus === 'guard') next.shopGuard += item.amount;
  if (item.bonus === 'maxHp') { next.shopMaxHp += item.amount; next.maxHp += item.amount; next.hp += item.amount; }
  if (item.bonus === 'maxQi') { next.shopMaxQi += item.amount; next.maxQi += item.amount; next.qi += item.amount; }
  next.chronicle = [...next.chronicle, `${run.year} · ${phase} · 你花 ${item.price} 銀兩買下${item.name}（${item.effect}）。`];
  return next;
}

export function resolvePeacefulChoice(run: LifeRun, event: LifeEvent, choice: LifeChoice): LifeRun {
  if (run.dead || choice.resolution !== 'peaceful') return run;
  const succeeded = choiceSucceededFor(run, choice);
  const effects = [...adjustedEffects(run, choice, choice.commitEffects), ...adjustedEffects(run, choice, succeeded ? choice.successEffects : choice.failureEffects)];
  let next = applyLifeEffects(run, effects);
  const canGrow = next.stats[choice.growthStat] < next.potential[choice.growthStat];
  const stats = { ...next.stats, [choice.growthStat]: next.stats[choice.growthStat] + (canGrow ? 1 : 0) };
  const nextTurn = run.turn + 1;
  const avoidedWithMoney = choice.id.includes('permit');
  const moment = avoidedWithMoney ? '用銀兩買掉一場仗' : '沒有拔刀也留下後果';
  const chronicle = `${run.year} · ${phaseForTurn(run.turn).name} · ${event.title}：${moment}`;
  const rewards = [describeChoiceEffects(run, choice, succeeded), canGrow ? `${statNames[choice.growthStat]} +1` : `${statNames[choice.growthStat]} 已到潛力`, `下一回合會記得「${choice.title}」`];
  next = { ...next, stats, turn: nextTurn, age: phaseForTurn(Math.min(15, nextTurn)).age, year: phaseForTurn(Math.min(15, nextTurn)).year, moments: [...next.moments, moment].slice(-24), chronicle: [...next.chronicle, chronicle], result: { kind: 'peaceful', won: true, grade: 'B', score: 0, moments: [moment], line: avoidedWithMoney ? '你沒有證明自己更能打；你證明了銀兩、情報和一張對的文書可以讓人不必打。' : '事情被處理掉了，但選擇仍會在下一回合回來找你。', rewards }, battle: null, battleMeta: null };
  return next;
}

export function startBattle(run: LifeRun, event: LifeEvent, choice: LifeChoice): LifeRun {
  if (run.dead) return run;
  const sect = resolvedSectFor(run);
  const choiceChance = choiceChanceFor(run, choice);
  const choiceSucceeded = choiceSucceededFor(run, choice);
  const battleEvent: LifeEvent = { ...event, ...choice.encounter, objective: choice.encounter?.objective ?? event.objective, choices: event.choices };
  const feedback = preparationFeedbackFor(run, battleEvent, choice, choiceSucceeded);
  const outcomeEffects = adjustedEffects(run, choice, choiceSucceeded ? choice.successEffects : choice.failureEffects);
  const next: LifeRun = applyLifeEffects({ ...run, stats: { ...run.stats }, battle: null, result: null }, [...adjustedEffects(run, choice, choice.commitEffects), ...outcomeEffects]);
  const preparation = { ...(choiceSucceeded ? choice.battlePreparation.success : choice.battlePreparation.failure) };
  if (hasTalent(run, '先禮後兵') && choice.tags.includes('parley')) preparation.guard = (preparation.guard ?? 0) + 20;
  if (hasTalent(run, '氣走得太急')) { next.qi = Math.min(next.maxQi, next.qi + 12); next.hp = Math.max(1, next.hp - 5); }
  if (hasTalent(run, '背水才會贏')) next.hp = Math.max(1, Math.min(next.hp, Math.floor(next.maxHp * .55)));
  const revenge = hasTalent(run, '很會記仇') ? Math.floor(next.rivalry / 2) * 3 : 0;
  const mountainGrudge = run.burden === '師父欠你一句道歉' ? (phaseForTurn(run.turn).name === '入門' ? 7 : -2) : 0;
  const rainFocus = hasTalent(run, '雨天手穩') ? (event.weather === '雨' ? 8 : -2) : 0;
  const crowdFocus = hasTalent(run, '人多反而冷靜') ? (event.enemyCount >= 2 ? 7 : -2) : 0;
  const poorPride = hasTalent(run, '越窮越有志氣') ? (run.money <= 10 ? 7 : -2) : 0;
  const courtesy = hasTalent(run, '先禮後兵') && !choice.tags.includes('parley') ? -2 : 0;
  const lastStand = hasTalent(run, '背水才會贏') ? 14 : 0;
  const fearGuard = run.burden === '你其實很怕打架' ? 16 : 0;
  const friendThreshold = hasTalent(run, '四海皆兄弟') ? 3 : 6;
  const hiredHelp = next.sliceFlags.includes('hired-help');
  const friend = next.companionJoined || hiredHelp || (preparation.inviteFriend && next.friendship >= friendThreshold) ? friendActor(next) : null;
  const loneBrother = hasTalent(run, '四海皆兄弟') && !friend ? -5 : 0;
  const routeDefense = hasTalent(run, '記路很牢') && event.weather === '風' ? 3 : 0;
  const speedTalent = (hasTalent(run, '手腳俐落') ? 2 : 0) - (hasTalent(run, '吃苦耐勞') ? 1 : 0);
  const playerSpeed = 7 + next.stats.agility + next.upgradeSpeed + speedTalent + (preparation.speed ?? 0);
  const player: BattleActor = { id: 'player', name: next.name, role: 'player', side: 'ally', hp: next.hp, maxHp: next.maxHp, qi: next.qi, maxQi: next.maxQi, attack: 8 + next.stats.strength * 2 + next.shopAttack + (preparation.attack ?? 0) + revenge + mountainGrudge + rainFocus + crowdFocus + poorPride + courtesy + lastStand + loneBrother + Math.floor(next.rivalry / 3) - (run.burden === '你其實很怕打架' ? 3 : 0), defense: 3 + next.stats.constitution + next.shopDefense + routeDefense + (preparation.defense ?? 0), guard: next.shopGuard + (preparation.guard ?? 0) + fearGuard + lastStand + Math.floor(next.friendship / 3) * 2, progress: 0, baseSpeed: playerSpeed, speed: playerSpeed, actionsTaken: 0, actionIds: sect.moves.map((move) => move.id), passiveIds: [] };
  const battle = createBattle({ seed: `${next.seed}:battle:${next.turn}:${choice.id}`, rngIndex: 0, encounterId: `life-${next.turn}`, title: battleEvent.title, cause: `${choiceSucceeded ? '準備成功' : '準備失手'}（${choiceChance}%）：${feedback.bridge}`, stakes: `${battleEvent.objective.label}：${battleEvent.objective.description}`, mandatory: true, actors: [player, ...(friend ? [friend] : []), ...Array.from({ length: battleEvent.enemyCount }, (_, index) => enemyActor(next, battleEvent, index, preparation.enemyAttack ?? 0))], resources: { money: next.money, phoneCharges: 0, flags: [], talents: {}, strength: next.stats.strength, partySize: friend ? 1 : 0 } }, rulesFor(sect));
  next.battle = battle;
  next.battleMeta = { choiceId: choice.id, growthStat: choice.growthStat, choiceSucceeded, choiceChance, feedback, preparation, actions: [], damageTaken: 0, damageDealt: 0, startedHp: player.hp, startedQi: player.qi };
  return next;
}

export function advance(run: LifeRun): LifeRun {
  if (!run.battle || !run.sectId) return run;
  const transition = reduceBattle(run.battle, { type: 'advance' }, rulesFor(resolvedSectFor(run)));
  const player = transition.state.actors.find((actor) => actor.id === 'player');
  const damageTaken = Math.max(0, (run.battleMeta?.startedHp ?? player?.hp ?? 0) - (player?.hp ?? 0));
  return { ...run, battle: transition.state, battleMeta: run.battleMeta ? { ...run.battleMeta, damageTaken } : null };
}

export function performMove(run: LifeRun, actionId: string): LifeRun {
  if (!run.battle || !run.sectId || run.battle.readyActorId !== 'player') return run;
  const transition = reduceBattle(run.battle, { type: 'use-action', actionId, targetId: run.battle.selectedTargetId ?? undefined }, rulesFor(resolvedSectFor(run)));
  const damage = transition.events.filter((event) => event.type === 'action').flatMap((event) => event.outcomes).reduce((total, outcome) => total + (outcome.type === 'damage' && outcome.sourceId === 'player' ? outcome.amount : 0), 0);
  const player = transition.state.actors.find((actor) => actor.id === 'player');
  const damageTaken = Math.max(0, (run.battleMeta?.startedHp ?? player?.hp ?? 0) - (player?.hp ?? 0));
  return { ...run, battle: transition.state, battleMeta: run.battleMeta ? { ...run.battleMeta, actions: [...run.battleMeta.actions, actionId], damageDealt: run.battleMeta.damageDealt + damage, damageTaken } : null };
}

export function selectTarget(run: LifeRun, targetId: string): LifeRun {
  if (!run.battle || !run.sectId) return run;
  const transition = reduceBattle(run.battle, { type: 'select-target', targetId }, rulesFor(resolvedSectFor(run)));
  return { ...run, battle: transition.state };
}

export function resolveBattle(run: LifeRun): LifeRun {
  if (!run.battle || !run.battleMeta || !run.battle.result) return run;
  const won = run.battle.result === 'victory';
  const player = run.battle.actors.find((actor) => actor.id === 'player');
  const hpPercent = Math.max(0, (player?.hp ?? 0) / run.maxHp);
  const uniqueActions = new Set(run.battleMeta.actions).size;
  let score = (won ? 42 : 18) + Math.min(22, uniqueActions * 6) + Math.min(18, Math.floor(run.battleMeta.damageDealt / 20)) + Math.round(hpPercent * 18);
  if (run.battleMeta.startedHp / run.maxHp < .35 && won) score += 14;
  const grade = score >= 92 ? 'SSS' : score >= 76 ? 'S' : score >= 61 ? 'A' : score >= 43 ? 'B' : 'C';
  const sect = sectFor(run.sectId);
  const moments: string[] = [];
  if (won && run.battleMeta.startedHp / run.maxHp < .35) moments.push('逆境翻盤');
  const gainedInjury = won && hpPercent <= .35;
  if (gainedInjury) moments.push('帶傷收場');
  if (new Set(run.battleMeta.actions).size >= 3) moments.push('這也算一招');
  if (sect.id === 'tang' && run.battle.actors.some((actor) => (actor.statuses?.toxin ?? 0) >= 2)) moments.push('毒還在上班');
  if (sect.id === 'huashan' && run.battleMeta.actions.includes('huashan-break')) moments.push('一式破局');
  if (run.battle.actors.some((actor) => actor.id === 'friend') && won) moments.push('並肩作戰');
  if (run.battleMeta.choiceSucceeded === true) moments.push('準備得手');
  if (run.battleMeta.choiceSucceeded === false) moments.push('臨陣失算');
  if (!won) moments.unshift('江湖除名');
  else if (!moments.length) moments.push('很難解釋，但贏了');
  const phase = phaseForTurn(run.turn);
  if (!won) {
    const deathReasons = [
      '死因：對手招招致命，你招招都很有想法。',
      '死因：最後一招沒接住。江湖規矩很多，復活不在其中。',
      '死因：內力先見底，氣血隨後跟進，只有欠款始終充沛。',
      '死因：你看懂了對方的招式，可惜雙腳晚了半步。',
      '死因：輕功慢了半步，訃告倒是傳得很快。',
      '死因：你格擋得很有禮貌，對方下手沒有。',
      '死因：你把最後一口氣用來說「還能打」。江湖沒有採信。',
      `死因：你倒在「${run.battle.title}」。江湖稱之為宿命，債主稱之為壞帳。`,
    ];
    const deathReason = pick(deathReasons, `${run.seed}:death:${run.turn}:${run.battle.title}`);
    const chronicle = `${run.year} · ${phase.name} · ${run.battle.title}：亡（${grade}）· ${deathReason.replace('死因：', '')}`;
    const wins = run.chronicle.filter((entry) => entry.includes('：勝')).length;
    const result: BattleResultCard = { kind: 'battle', won: false, grade, score, moments, line: deathReason, rewards: [`享年 ${run.age} 歲`, `生前勝場 ${wins}`, '復活：門派未編列預算'] };
    return { ...run, hp: 0, turn: run.turn + 1, dead: true, deathReason, pendingUpgrade: false, moments: [...run.moments, ...moments].slice(-24), chronicle: [...run.chronicle, chronicle], battle: null, battleMeta: null, result };
  }
  const injury = run.injury + (gainedInjury ? 1 : 0);
  const growthKey = run.battleMeta.growthStat;
  const canGrow = run.stats[growthKey] < run.potential[growthKey];
  const growthGain = canGrow ? Math.min(hasTalent(run, '天妒英才') ? 2 : 1, run.potential[growthKey] - run.stats[growthKey]) : 0;
  const stats = { ...run.stats, [growthKey]: run.stats[growthKey] + growthGain };
  const maxHp = maximumHp(stats, run);
  const maxQi = maximumQi(stats, run);
  const recoveryRate = hasTalent(run, '吃苦耐勞') ? .72 : hasTalent(run, '很會記仇') ? Math.max(.4, .6 - run.rivalry * .02) : .6;
  const recoveredHp = Math.max(18, Math.round(maxHp * recoveryRate));
  const proficiencyGain = ({ C: 5, B: 7, A: 10, S: 14, SSS: 18 } as const)[grade];
  const chronicle = `${run.year} · ${phase.name} · ${run.battle.title}：勝（${grade}）· ${moments[0]}`;
  const fateStudy = hasTalent(run, '運氣不太好') ? 14 : 0;
  const homePay = hasTalent(run, '不愛空手回家') ? 2 : 0;
  const proficiency = run.proficiency + proficiencyGain + fateStudy;
  const crossedTier = insightThresholds.find((threshold, index) => run.proficiency < threshold && proficiency >= threshold && !run.insights.some((id) => id.includes(`-${index + 1}-`)));
  const result: BattleResultCard = { kind: 'battle', won: true, grade, score, moments, line: `${sect.name}的人看你一眼，像是在考慮要不要承認你其實還行。`, rewards: [`造詣 +${proficiencyGain + fateStudy} · ${proficiency}${crossedTier ? `（可領悟第 ${insightThresholds.indexOf(crossedTier) + 1} 階）` : ''}`, canGrow ? `${statNames[growthKey]} +${growthGain} · 靠近潛力` : `${statNames[growthKey]} 已到目前潛力`, `名聲 +2${homePay ? '、銀兩 +2' : ''}${gainedInjury ? `、舊傷 +1（共 ${injury}）` : ''}`] };
  return { ...run, stats, maxHp, maxQi, turn: run.turn + 1, age: phaseForTurn(Math.min(15, run.turn + 1)).age, year: phaseForTurn(Math.min(15, run.turn + 1)).year, hp: recoveredHp, qi: Math.max(8, Math.round(maxQi * .7)), money: run.money + homePay, proficiency, reputation: run.reputation + 2, injury, pendingUpgrade: true, moments: [...run.moments, ...moments].slice(-24), chronicle: [...run.chronicle, chronicle], battle: null, battleMeta: null, result };
}

export function isComplete(run: LifeRun) { return run.dead || run.turn >= 16; }
export function endingFor(run: LifeRun) {
  const sect = sectFor(run.sectId);
  if (run.dead) return { sect, peak: '英年早退', sentence: run.deathReason ?? '死因：江湖不肯說，郎中也不肯退診金。', relationship: run.friendship >= run.rivalry ? `${run.friendName} · 替你收劍` : `${run.rivalName} · 終於閉嘴了一天` };
  const peak = run.insights.length >= 3 ? '自成一家' : run.reputation >= 24 ? '一方名宿' : run.insights.length >= 2 ? '招牌高手' : run.bond >= 18 ? '江湖好人' : '認真活過的人';
  const definingInsight = insightDefinitions.find((item) => item.id === run.insights.at(-1));
  const sentence = run.insights.length >= 3 && definingInsight ? `你把${definingInsight.name}練成了自己的答案；${run.friendship >= run.rivalry ? run.friendName : run.rivalName}記得那不是天授，是一路選出來的。` : run.injury >= 4 ? `你沒能全身而退，但${run.friendship >= 6 ? run.friendName : '很多人'}記得你每次都先問「有沒有吃飯」。` : run.friendship >= 10 ? `後來提起你，${run.friendName}總說你打架不一定漂亮，做人倒是很準時。` : run.rivalry >= 7 ? `${run.rivalName}後來仍不服你；這種不服，剛好替你把名聲傳得很遠。` : run.reputation >= 24 ? `你把名號活成了招牌，也把招牌活成了麻煩。` : `你沒有改變整個江湖，但改變了幾個人的下雨天。`;
  return { sect, peak, sentence, relationship: run.friendship >= run.rivalry ? `${run.friendName} · 交情 ${run.friendship}` : `${run.rivalName} · 宿敵 ${run.rivalry}` };
}
