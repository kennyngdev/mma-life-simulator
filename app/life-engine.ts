import { createBattle, reduceBattle, type BattleActionDefinition, type BattleActor, type BattleRules, type BattleState } from './battle';

export type SectId = 'huashan' | 'shaolin' | 'wudang' | 'beggar' | 'emei' | 'tang';
export type DifficultyId = 'relaxed' | 'standard' | 'hard';
export type LifePhase = '少年' | '入門' | '闖蕩' | '成名' | '晚年';
export type LifeScreen = 'start' | 'reveal' | 'sect' | 'life' | 'battle' | 'result' | 'ending';
export type StatKey = 'strength' | 'agility' | 'constitution' | 'wisdom' | 'will' | 'luck';

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

export type LifeChoice = { id: 'train' | 'work' | 'help'; title: string; description: string; reward: string; prep: string };
export type EncounterObjective = { id: 'duel' | 'ambush' | 'crowd' | 'siege'; label: string; description: string; enemyRole: 'warrior' | 'assassin' | 'tank'; enemyCount: number };
export type LifeEvent = { title: string; place: string; lead: string; weather: '晴' | '雨' | '風'; objective: EncounterObjective; enemyName: string; enemyRole: 'warrior' | 'assassin' | 'tank'; enemyCount: number; choices: LifeChoice[] };
export type BattleMeta = { choiceId: LifeChoice['id']; actions: string[]; damageTaken: number; damageDealt: number; startedHp: number; startedQi: number };
export type BattleResultCard = { won: boolean; grade: 'C' | 'B' | 'A' | 'S' | 'SSS'; score: number; moments: string[]; line: string; rewards: string[] };

export type LifeRun = {
  version: 4;
  seed: string;
  name: string;
  origin: string;
  trait: string;
  burden: string;
  difficulty: DifficultyId;
  legacyRank: number;
  legacyClaimed: boolean;
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
  mastery: number;
  reputation: number;
  bond: number;
  friendName: string;
  rivalName: string;
  friendship: number;
  rivalry: number;
  injury: number;
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
const pick = <T,>(items: T[], seed: string) => items[hash(seed) % items.length];
const range = (seed: string, min: number, max: number) => min + (hash(seed) % (max - min + 1));

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

const strike = (id: string, target: BattleActionDefinition['target'], qiCost: number, effects: BattleActionDefinition['effects']): BattleActionDefinition => ({ id, target, qiCost, effects });

export const sects: Sect[] = [
  {
    id: 'huashan', name: '華山', subtitle: '劍路越長，理由越少', color: '#e7a85f', icon: '劍', style: '連續進招，累積劍式後一口氣收尾。', quip: '師兄說這叫劍意。你看了一下，像是很貴的加班。',
    moves: [
      { id: 'huashan-start', name: '起手式', description: '穩定傷害，累積劍式。', qiCost: 0, action: strike('huashan-start', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.06 }, { type: 'apply-status', id: 'sword-form', stacks: 1, target: 'self' }]) },
      { id: 'huashan-break', name: '破雲一線', description: '消耗劍式，狠狠收尾。', qiCost: 12, action: strike('huashan-break', 'selected-enemy', 12, [{ type: 'consume-status-damage', id: 'sword-form', damagePerStack: 13, statusTarget: 'self' }, { type: 'damage', multiplier: 1.28 }]) },
      { id: 'huashan-breath', name: '收劍調息', description: '回內力，也把人生放回劍鞘。', qiCost: 0, action: strike('huashan-breath', 'self', 0, [{ type: 'restore-qi', amount: 12 }, { type: 'guard', amount: 8 }]) },
      { id: 'huashan-screen', name: '回風守勢', description: '擋一下，順便讓人知道你有在上課。', qiCost: 7, action: strike('huashan-screen', 'self', 7, [{ type: 'counter', damage: 13 }, { type: 'reduce-next-hit', percent: .45 }]) },
    ],
  },
  {
    id: 'shaolin', name: '少林', subtitle: '把麻煩站到沒力', color: '#e8c669', icon: '拳', style: '護體、續航、反震，越被打越難處理。', quip: '師父說忍耐是修行。你覺得他只是沒預算修屋頂。',
    moves: [
      { id: 'shaolin-palm', name: '伏虎掌', description: '穩穩一掌，附帶護體。', qiCost: 0, action: strike('shaolin-palm', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.02 }, { type: 'guard', amount: 8 }]) },
      { id: 'shaolin-bell', name: '金鐘撞', description: '有盾才叫輸出，沒有叫意外。', qiCost: 13, action: strike('shaolin-bell', 'selected-enemy', 13, [{ type: 'damage', multiplier: 1.45 }, { type: 'guard', amount: 18 }]) },
      { id: 'shaolin-meditate', name: '坐忘', description: '回氣回血，暫時不回訊息。', qiCost: 0, action: strike('shaolin-meditate', 'self', 0, [{ type: 'heal', amount: 18 }, { type: 'restore-qi', amount: 8 }]) },
      { id: 'shaolin-stance', name: '不動明王', description: '下次挨打少一點，嘴硬多一點。', qiCost: 8, action: strike('shaolin-stance', 'self', 8, [{ type: 'guard', amount: 24 }, { type: 'reduce-next-hit', percent: .55 }]) },
    ],
  },
  {
    id: 'wudang', name: '武當', subtitle: '借力可以，借錢不行', color: '#7ab8c5', icon: '太', style: '調息、化勁、反擊，把對方的努力退回去。', quip: '武當講究順勢而為。你第一天就發現勢通常是別人安排的。',
    moves: [
      { id: 'wudang-cloud', name: '雲手', description: '借勢一擊，讓對方先想想。', qiCost: 0, action: strike('wudang-cloud', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.04 }, { type: 'expose-next-hit', percent: .2 }]) },
      { id: 'wudang-turn', name: '借力打力', description: '先把局面推回去。', qiCost: 11, action: strike('wudang-turn', 'selected-enemy', 11, [{ type: 'damage', multiplier: 1.3 }, { type: 'reduce-next-hit', percent: .4 }]) },
      { id: 'wudang-breath', name: '太和吐納', description: '呼吸一下，世界不一定會好。', qiCost: 0, action: strike('wudang-breath', 'self', 0, [{ type: 'heal', amount: 12 }, { type: 'restore-qi', amount: 13 }]) },
      { id: 'wudang-circle', name: '圓轉如意', description: '把對方的熱情退貨。', qiCost: 8, action: strike('wudang-circle', 'self', 8, [{ type: 'counter', damage: 17 }, { type: 'guard', amount: 12 }]) },
    ],
  },
  {
    id: 'beggar', name: '丐幫', subtitle: '人脈很廣，住處很窄', color: '#92b86d', icon: '棍', style: '連打、回氣、靠一點人情和很多臉皮。', quip: '丐幫消息最快，因為大家都在路邊，沒有會議室可以躲。',
    moves: [
      { id: 'beggar-stick', name: '打狗棒影', description: '一棍先問候，第二棍再解釋。', qiCost: 0, action: strike('beggar-stick', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.1 }]) },
      { id: 'beggar-wave', name: '百家一棍', description: '把街坊的意見集中寄出。', qiCost: 12, action: strike('beggar-wave', 'selected-enemy', 12, [{ type: 'damage', multiplier: 1.5 }, { type: 'restore-qi', amount: 5 }]) },
      { id: 'beggar-wine', name: '一口濁酒', description: '不保證衛生，保證有精神。', qiCost: 0, action: strike('beggar-wine', 'self', 0, [{ type: 'heal', amount: 15 }, { type: 'restore-qi', amount: 10 }]) },
      { id: 'beggar-footwork', name: '巷口步', description: '先退半步，讓他以為自己贏了。', qiCost: 7, action: strike('beggar-footwork', 'self', 7, [{ type: 'guard', amount: 16 }, { type: 'counter', damage: 12 }]) },
    ],
  },
  {
    id: 'emei', name: '峨眉', subtitle: '手很穩，耐心有限', color: '#c88cad', icon: '針', style: '點穴、精準與照料，讓對方每一步都不舒服。', quip: '峨眉的規矩不多，主要是每條都能讓你後悔。',
    moves: [
      { id: 'emei-needle', name: '拂塵點穴', description: '精準一擊，讓對方先別急。', qiCost: 0, action: strike('emei-needle', 'selected-enemy', 0, [{ type: 'damage', multiplier: 1.05 }, { type: 'expose-next-hit', percent: .25 }]) },
      { id: 'emei-moon', name: '月影封脈', description: '把你的人生行程往後排。', qiCost: 12, action: strike('emei-moon', 'selected-enemy', 12, [{ type: 'damage', multiplier: 1.35 }, { type: 'apply-status', id: 'toxin', stacks: 1, target: 'target' }]) },
      { id: 'emei-medicine', name: '靜心敷藥', description: '先照顧自己，這不叫自私。', qiCost: 0, action: strike('emei-medicine', 'self', 0, [{ type: 'heal', amount: 22 }]) },
      { id: 'emei-parry', name: '清規攔人', description: '拒絕得很有禮貌，但很難過。', qiCost: 7, action: strike('emei-parry', 'self', 7, [{ type: 'guard', amount: 14 }, { type: 'counter', damage: 15 }]) },
    ],
  },
  {
    id: 'tang', name: '唐門', subtitle: '不近人情，近距離很危險', color: '#a681d1', icon: '鏢', style: '暗器、毒性、延遲，讓戰鬥自己變糟。', quip: '唐門說暗器是藝術。你看帳單後覺得確實很藝術。',
    moves: [
      { id: 'tang-needle', name: '細雨針', description: '傷害不高，心情會慢慢變差。', qiCost: 0, action: strike('tang-needle', 'selected-enemy', 0, [{ type: 'damage', multiplier: .92 }, { type: 'apply-status', id: 'toxin', stacks: 1, target: 'target' }]) },
      { id: 'tang-bloom', name: '暴雨梨花', description: '把累積的不滿一次寄出。', qiCost: 12, action: strike('tang-bloom', 'selected-enemy', 12, [{ type: 'consume-status-damage', id: 'toxin', damagePerStack: 18 }, { type: 'damage', multiplier: 1.18 }]) },
      { id: 'tang-antidote', name: '以毒養氣', description: '聽起來不健康，但有效。', qiCost: 0, action: strike('tang-antidote', 'self', 0, [{ type: 'heal', amount: 15 }, { type: 'restore-qi', amount: 10 }]) },
      { id: 'tang-smoke', name: '迷煙退場', description: '不叫逃跑，叫保留選項。', qiCost: 8, action: strike('tang-smoke', 'self', 8, [{ type: 'guard', amount: 18 }, { type: 'counter', damage: 10 }]) },
    ],
  },
];

export const origins = ['藥鋪學徒', '鏢局雜役', '沒落軍戶', '寺外棄童', '商隊小孩', '縣城學徒'] as const;
export const traits = ['過目不忘', '雨天手穩', '很會記仇', '吃苦耐勞', '臉皮很厚', '運氣不太好'] as const;
export const burdens = ['家裡欠了錢', '有人等你回家', '師父欠你一句道歉', '你其實很怕打架', '一封信一直沒寄', '大家以為你很有錢'] as const;
const friends = ['阿棠', '石見山', '柳小七', '顧晚舟', '沈二娘', '唐十三'];
const rivals = ['范少白', '段鐵嘴', '莫問天', '金如意', '霍三娘', '葉無聲'];

const originBonus: Record<(typeof origins)[number], Partial<Record<StatKey, number>> & { money?: number }> = {
  '藥鋪學徒': { wisdom: 1, will: 1 }, '鏢局雜役': { agility: 1, constitution: 1 }, '沒落軍戶': { strength: 1, will: 1 },
  '寺外棄童': { luck: 1, constitution: 1 }, '商隊小孩': { luck: 1, money: 8 }, '縣城學徒': { wisdom: 2 },
};
const traitCopy: Record<(typeof traits)[number], string> = {
  '過目不忘': '練功後更容易把悟到的東西留下。', '雨天手穩': '下雨的戰鬥，攻勢明顯更準。', '很會記仇': '帶著舊傷時，出手格外有精神。',
  '吃苦耐勞': '根骨特別結實，恢復也不太講道理。', '臉皮很厚': '接差事時多賺一點，也比較不怕丟臉。', '運氣不太好': '壞事常常找上門，但敗戰悟性來得更快。',
};
const burdenCopy: Record<(typeof burdens)[number], string> = {
  '家裡欠了錢': '每次接差事，先有兩文錢被命運拿走。', '有人等你回家': '管閒事時更容易累積人情。', '師父欠你一句道歉': '在門派裡特別不想輸。',
  '你其實很怕打架': '開戰時先有一點護盾，但攻勢較保守。', '一封信一直沒寄': '晚年時總會想起某件沒做的事。', '大家以為你很有錢': '賺到的錢會有一小部分神秘蒸發。',
};

export function identityDetail(kind: 'trait' | 'burden', value: string) {
  return kind === 'trait' ? traitCopy[value as keyof typeof traitCopy] : burdenCopy[value as keyof typeof burdenCopy];
}

export function phaseForTurn(turn: number) { return phases.find((phase) => turn >= phase.start && turn <= phase.end) ?? phases.at(-1)!; }
export function sectFor(id: SectId | null) { return sects.find((sect) => sect.id === id) ?? sects[0]; }
export function difficultyFor(id: DifficultyId) { return difficulties.find((difficulty) => difficulty.id === id) ?? difficulties[1]; }
export function choiceRewardFor(run: LifeRun, choiceId: LifeChoice['id']) {
  if (choiceId === 'train') return `武學 +${run.trait === '過目不忘' ? 18 : 12}、內力 +6`;
  if (choiceId === 'work') return `銀兩 +${(run.trait === '臉皮很厚' ? 14 : 10) - (run.burden === '家裡欠了錢' ? 2 : 0) - (run.burden === '大家以為你很有錢' ? 3 : 0)}、名聲 +${run.trait === '臉皮很厚' ? 2 : 1}`;
  return `人情 +${run.burden === '有人等你回家' ? 4 : 2}、氣血 +10`;
}

export function newLife(seed: string, name: string, difficulty: DifficultyId = 'standard', legacyRank = 0): LifeRun {
  const origin = pick([...origins], `${seed}:origin`);
  const trait = pick([...traits], `${seed}:trait`);
  const burden = pick([...burdens], `${seed}:burden`);
  const stats = Object.fromEntries((Object.keys(statNames) as StatKey[]).map((key) => [key, range(`${seed}:${key}`, 3, 7) + (originBonus[origin][key] ?? 0)])) as Record<StatKey, number>;
  const potential = Object.fromEntries((Object.keys(statNames) as StatKey[]).map((key) => [key, stats[key] + range(`${seed}:potential:${key}`, 3, 6)])) as Record<StatKey, number>;
  const maxHp = 66 + stats.constitution * 7 + (trait === '吃苦耐勞' ? 12 : 0);
  const maxQi = 24 + stats.will * 3;
  return { version: 4, seed, name: name.trim() || '無名少俠', origin, trait, burden, difficulty, legacyRank, legacyClaimed: false, sectId: null, age: 12, year: 1590, turn: 0, stats, potential, hp: maxHp, maxHp, qi: maxQi, maxQi, money: range(`${seed}:money`, 8, 22) + (originBonus[origin].money ?? 0) - (burden === '家裡欠了錢' ? 6 : 0), mastery: legacyRank * 5, reputation: 0, bond: 0, friendName: pick(friends, `${seed}:friend`), rivalName: pick(rivals, `${seed}:rival`), friendship: 0, rivalry: 0, injury: 0, moments: [], chronicle: [], battle: null, battleMeta: null, result: null };
}

export function eventFor(run: LifeRun): LifeEvent {
  const phase = phaseForTurn(run.turn);
  const sect = sectFor(run.sectId);
  const themes: Record<LifePhase, Array<{ title: string; place: string; lead: string; enemy: string }>> = {
    少年: [
      { title: '柴房的第一堂課', place: '城外破廟', lead: '你只是想找個不漏雨的地方練拳，結果發現這裡的住戶對共享空間有很強的意見。', enemy: '地痞' },
      { title: '學費可以晚點交嗎', place: '山門石階', lead: '招收新弟子的告示寫得很有氣勢，收費細則寫得更有。', enemy: '看門弟子' },
      { title: '把人送回家', place: '夜市巷口', lead: '你幫人搬貨，對方說只是一小段路。江湖裡「一小段」通常會出事。', enemy: '醉漢' },
    ],
    入門: [
      { title: '門派大掃除', place: '後山演武場', lead: `${sect.name}說這叫磨練心性。你看著三十桶水，覺得心性已經磨到沒有了。`, enemy: '搶水的師兄' },
      { title: '師兄的友善提醒', place: '練功房', lead: '有人很熱心地要幫你「測試程度」。旁邊的人已經開始下注。', enemy: '熱心師兄' },
      { title: '山下採買', place: '市集', lead: '你只是買鹽，卻被捲進一場關於誰欠誰三文錢的武林大事。', enemy: '攤販打手' },
      { title: '公告欄風波', place: '山門外', lead: '有人在公告欄貼了匿名批評。你本來想路過，名字卻剛好被寫得很大。', enemy: '匿名高手' },
    ],
    闖蕩: [
      { title: '客戶說很簡單', place: '鏢局外', lead: '委託人說路上絕對安全。這句話的江湖翻譯是：請自備棺材。', enemy: '攔路客' },
      { title: '英雄折扣', place: '河渡', lead: '船夫認出你的名號後加了價。他說這是支持本地文化。', enemy: '河盜' },
      { title: '不小心上了熱榜', place: '茶樓', lead: '你的一場小衝突被說書人講成三百回。有人決定親自來驗證。', enemy: '挑戰者' },
      { title: '房租與劍氣', place: '縣城客棧', lead: '掌櫃說屋頂漏水是自然景觀，房價因此不能降。你第一次想用劍講道理。', enemy: '催租打手' },
    ],
    成名: [
      { title: '江湖訪談', place: '大酒樓', lead: '有人要替你做人物專訪，問題從武學一路問到你有沒有固定交往對象。', enemy: '蹭名挑戰者' },
      { title: '名號被註冊了', place: '商會', lead: '商會說你的名號有人先拿去賣護身符。你得先證明自己是自己。', enemy: '商會護衛' },
      { title: '舊友來借錢', place: '雨亭', lead: '舊友說不是來借錢，只是需要你用武功替他談一件很小的事。', enemy: '債主' },
    ],
    晚年: [
      { title: '年輕人很有想法', place: '山道', lead: '新一代少俠說你的招式太老。你同意，然後決定讓他親自體驗歷史。', enemy: '新秀' },
      { title: '最後一份委託', place: '荒村', lead: '你本來只想回家，卻又有人把希望塞到你手上。這次連拒絕都很麻煩。', enemy: '舊怨' },
    ],
  };
  const template = pick(themes[phase.name], `${run.seed}:event:${run.turn}`);
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
  return { title: rivalScene ? (run.turn === 6 ? '那個人又來了' : '名聲總會帶人回來') : template.title, place: rivalScene ? (run.turn === 6 ? '山門外石階' : '雨後茶樓') : template.place, lead: rivalScene ? (run.turn === 6 ? `${run.rivalName}說你最近太得意。你回想了一下，自己明明只是在正常呼吸。` : `${run.rivalName}隔著人群叫出你的名字。這一次，旁邊已經有人開始替你們點評。`) : template.lead, weather, objective: rivalScene ? rivalObjective : objective, enemyName: rivalScene ? run.rivalName : template.enemy, enemyRole: rivalScene ? rivalObjective.enemyRole : objective.enemyRole, enemyCount: rivalScene ? rivalObjective.enemyCount : objective.enemyCount, choices: [
    { id: 'train', title: '先把招練熟', description: '少說兩句，先讓身體記住。', reward: '武學 +12、內力 +6', prep: '你在開打前多練了幾遍，至少不是純靠勇氣。' },
    { id: 'work', title: '接下這份差事', description: '錢不多，但對方看起來真的會給。', reward: '銀兩 +10、名聲 +1', prep: '你先談好價錢。這在江湖裡已經算很專業。' },
    { id: 'help', title: '管這個閒事', description: '理智說別去，腳已經先到了。', reward: '人情 +2、氣血 +10', prep: '你替人站了一次，現在得站到底。' },
  ] };
}

function enemyActor(run: LifeRun, event: LifeEvent, index: number): BattleActor {
  const scale = Math.max(1, 1 + Math.floor(run.turn / 2) + index + difficultyFor(run.difficulty).enemyScale);
  const hp = 38 + scale * 13;
  return { id: `enemy-${index}`, name: index ? `${event.enemyName}同夥` : event.enemyName, role: event.enemyRole, side: 'enemy', hp, maxHp: hp, qi: 18 + scale * 2, maxQi: 18 + scale * 2, attack: 8 + scale * 3, defense: 3 + Math.floor(scale / 2), guard: 0, progress: 0, baseSpeed: event.enemyRole === 'assassin' ? 13 : event.enemyRole === 'tank' ? 7 : 10, speed: event.enemyRole === 'assassin' ? 13 : event.enemyRole === 'tank' ? 7 : 10, actionsTaken: 0, actionIds: [event.enemyRole === 'assassin' ? 'enemy-assassin' : event.enemyRole === 'tank' ? 'enemy-guard' : 'enemy-strike'], passiveIds: [] };
}

function friendActor(run: LifeRun): BattleActor {
  const hp = 48 + run.stats.constitution * 5 + run.friendship * 2;
  return { id: 'friend', name: run.friendName, role: 'healer', side: 'ally', hp, maxHp: hp, qi: 18 + run.friendship, maxQi: 18 + run.friendship, attack: 7 + Math.floor(run.mastery / 42) + Math.floor(run.friendship / 2), defense: 3 + Math.floor(run.friendship / 3), guard: 0, progress: 0, baseSpeed: 8 + Math.floor(run.stats.agility / 2), speed: 8 + Math.floor(run.stats.agility / 2), actionsTaken: 0, actionIds: ['friend-help', 'friend-strike'], passiveIds: [] };
}

export function rulesFor(sect: Sect): BattleRules {
  const moves = Object.fromEntries(sect.moves.map((move) => [move.id, move.action]));
  return { actions: {
    ...moves,
    'enemy-strike': strike('enemy-strike', 'random-foe', 0, [{ type: 'damage', multiplier: 1 }]),
    'enemy-assassin': strike('enemy-assassin', 'weakest-enemy', 4, [{ type: 'damage', multiplier: 1.22 }]),
    'enemy-guard': strike('enemy-guard', 'random-foe', 0, [{ type: 'damage', multiplier: .86 }, { type: 'guard', amount: 8 }]),
    'friend-help': strike('friend-help', 'weakest-ally', 7, [{ type: 'heal', amount: 14 }, { type: 'guard', amount: 7 }]),
    'friend-strike': strike('friend-strike', 'weakest-enemy', 0, [{ type: 'damage', multiplier: .86 }]),
  }, passives: {}, speedModifiers: [], damageModifiers: [] };
}

export function startBattle(run: LifeRun, event: LifeEvent, choice: LifeChoice): LifeRun {
  const sect = sectFor(run.sectId);
  const stats = { ...run.stats };
  const next = { ...run, stats, battle: null, result: null };
  if (choice.id === 'train') { next.mastery += run.trait === '過目不忘' ? 18 : 12; next.qi = Math.min(next.maxQi, next.qi + 6); }
  if (choice.id === 'work') { const earnings = run.trait === '臉皮很厚' ? 14 : 10; next.money += earnings - (run.burden === '家裡欠了錢' ? 2 : 0) - (run.burden === '大家以為你很有錢' ? 3 : 0); next.reputation += run.trait === '臉皮很厚' ? 2 : 1; }
  if (choice.id === 'help') { const connection = run.burden === '有人等你回家' ? 4 : 2; next.bond += connection; next.friendship += connection; next.hp = Math.min(next.maxHp, next.hp + 10); }
  if (choice.id === 'work') next.rivalry += 1;
  const revenge = run.trait === '很會記仇' ? run.injury * 2 : 0;
  const mountainGrudge = run.burden === '師父欠你一句道歉' && phaseForTurn(run.turn).name === '入門' ? 3 : 0;
  const rainFocus = run.trait === '雨天手穩' && event.weather === '雨' ? 5 : 0;
  const fearGuard = run.burden === '你其實很怕打架' ? 10 : 0;
  const player: BattleActor = { id: 'player', name: next.name, role: 'player', side: 'ally', hp: next.hp, maxHp: next.maxHp, qi: next.qi, maxQi: next.maxQi, attack: 8 + next.stats.strength * 2 + Math.floor(next.mastery / 35) + revenge + mountainGrudge + rainFocus + Math.floor(next.rivalry / 3) - (run.burden === '你其實很怕打架' ? 2 : 0), defense: 3 + next.stats.constitution, guard: (choice.id === 'train' ? 8 : choice.id === 'help' ? 12 : 0) + fearGuard + Math.floor(next.friendship / 3) * 2, progress: 0, baseSpeed: 7 + next.stats.agility, speed: 7 + next.stats.agility, actionsTaken: 0, actionIds: sect.moves.map((move) => move.id), passiveIds: [] };
  const friend = next.friendship >= 6 ? friendActor(next) : null;
  const battle = createBattle({ seed: `${next.seed}:battle:${next.turn}:${choice.id}`, rngIndex: 0, encounterId: `life-${next.turn}`, title: event.title, cause: choice.prep, stakes: `${event.objective.label}：${event.objective.description}`, mandatory: true, actors: [player, ...(friend ? [friend] : []), ...Array.from({ length: event.enemyCount }, (_, index) => enemyActor(next, event, index))], resources: { money: next.money, phoneCharges: 0, flags: [], talents: {}, strength: next.stats.strength, partySize: friend ? 1 : 0 } }, rulesFor(sect));
  next.battle = battle;
  next.battleMeta = { choiceId: choice.id, actions: [], damageTaken: 0, damageDealt: 0, startedHp: player.hp, startedQi: player.qi };
  return next;
}

export function advance(run: LifeRun): LifeRun {
  if (!run.battle || !run.sectId) return run;
  const transition = reduceBattle(run.battle, { type: 'advance' }, rulesFor(sectFor(run.sectId)));
  const player = transition.state.actors.find((actor) => actor.id === 'player');
  const damageTaken = Math.max(0, (run.battleMeta?.startedHp ?? player?.hp ?? 0) - (player?.hp ?? 0));
  return { ...run, battle: transition.state, battleMeta: run.battleMeta ? { ...run.battleMeta, damageTaken } : null };
}

export function performMove(run: LifeRun, actionId: string): LifeRun {
  if (!run.battle || !run.sectId || run.battle.readyActorId !== 'player') return run;
  const transition = reduceBattle(run.battle, { type: 'use-action', actionId, targetId: run.battle.selectedTargetId ?? undefined }, rulesFor(sectFor(run.sectId)));
  const damage = transition.events.filter((event) => event.type === 'action' && event.actorId === 'player').reduce((total, event) => total + (event.damage ?? 0), 0);
  const player = transition.state.actors.find((actor) => actor.id === 'player');
  const damageTaken = Math.max(0, (run.battleMeta?.startedHp ?? player?.hp ?? 0) - (player?.hp ?? 0));
  return { ...run, battle: transition.state, battleMeta: run.battleMeta ? { ...run.battleMeta, actions: [...run.battleMeta.actions, actionId], damageDealt: run.battleMeta.damageDealt + damage, damageTaken } : null };
}

export function selectTarget(run: LifeRun, targetId: string): LifeRun {
  if (!run.battle || !run.sectId) return run;
  const transition = reduceBattle(run.battle, { type: 'select-target', targetId }, rulesFor(sectFor(run.sectId)));
  return { ...run, battle: transition.state };
}

export function resolveBattle(run: LifeRun): LifeRun {
  if (!run.battle || !run.battleMeta) return run;
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
  if (new Set(run.battleMeta.actions).size >= 3) moments.push('這也算一招');
  if (sect.id === 'tang' && run.battle.actors.some((actor) => (actor.statuses?.toxin ?? 0) >= 2)) moments.push('毒還在上班');
  if (sect.id === 'huashan' && run.battleMeta.actions.includes('huashan-break')) moments.push('一式破局');
  if (run.battle.actors.some((actor) => actor.id === 'friend') && won) moments.push('並肩作戰');
  if (!moments.length) moments.push(won ? '很難解釋，但贏了' : '敗中悟招');
  const phase = phaseForTurn(run.turn);
  const injury = won ? Math.max(0, run.injury - 1) : run.injury + 1;
  const growthKey: StatKey = run.battleMeta.choiceId === 'train' ? (sect.id === 'wudang' || sect.id === 'emei' ? 'wisdom' : sect.id === 'tang' ? 'agility' : 'strength') : run.battleMeta.choiceId === 'work' ? 'luck' : 'will';
  const canGrow = run.stats[growthKey] < run.potential[growthKey];
  const stats = { ...run.stats, [growthKey]: run.stats[growthKey] + (canGrow ? 1 : 0) };
  const maxHp = 66 + stats.constitution * 7 + (run.trait === '吃苦耐勞' ? 12 : 0);
  const maxQi = 24 + stats.will * 3;
  const recoveredHp = won ? Math.max(18, Math.round(maxHp * (run.trait === '吃苦耐勞' ? .72 : .6))) : Math.max(12, Math.round(maxHp * .38));
  const masteryGain = ({ C: 5, B: 7, A: 10, S: 14, SSS: 18 } as const)[grade];
  const chronicle = `${run.year} · ${phase.name} · ${run.battle.title}：${won ? '勝' : '敗'}（${grade}）· ${moments[0]}`;
  const setbackStudy = !won && run.trait === '運氣不太好' ? 4 : 0;
  const result: BattleResultCard = { won, grade, score, moments, line: won ? `${sect.name}的人看你一眼，像是在考慮要不要承認你其實還行。` : '你沒有死，只是江湖暫時替你保留了臉面。', rewards: [`武學 +${masteryGain + setbackStudy}`, canGrow ? `${statNames[growthKey]} +1 · 靠近潛力` : `${statNames[growthKey]} 已到目前潛力`, won ? '名聲 +2' : injury ? `舊傷 ${injury} 層` : '身體狀況良好'] };
  return { ...run, stats, maxHp, maxQi, turn: run.turn + 1, age: phaseForTurn(Math.min(15, run.turn + 1)).age, year: phaseForTurn(Math.min(15, run.turn + 1)).year, hp: recoveredHp, qi: Math.max(8, Math.round(maxQi * .7)), mastery: run.mastery + masteryGain + setbackStudy, reputation: run.reputation + (won ? 2 : 0), injury, moments: [...run.moments, ...moments].slice(-24), chronicle: [...run.chronicle, chronicle], battle: null, battleMeta: null, result };
}

export function isComplete(run: LifeRun) { return run.turn >= 16; }
export function endingFor(run: LifeRun) {
  const sect = sectFor(run.sectId);
  const peak = run.reputation >= 24 ? '一方名宿' : run.mastery >= 150 ? '招牌高手' : run.bond >= 18 ? '江湖好人' : '認真活過的人';
  const sentence = run.injury >= 4 ? `你沒能全身而退，但${run.friendship >= 6 ? run.friendName : '很多人'}記得你每次都先問「有沒有吃飯」。` : run.friendship >= 10 ? `後來提起你，${run.friendName}總說你打架不一定漂亮，做人倒是很準時。` : run.rivalry >= 7 ? `${run.rivalName}後來仍不服你；這種不服，剛好替你把名聲傳得很遠。` : run.reputation >= 24 ? `你把名號活成了招牌，也把招牌活成了麻煩。` : `你沒有改變整個江湖，但改變了幾個人的下雨天。`;
  return { sect, peak, sentence, relationship: run.friendship >= run.rivalry ? `${run.friendName} · 交情 ${run.friendship}` : `${run.rivalName} · 宿敵 ${run.rivalry}` };
}
