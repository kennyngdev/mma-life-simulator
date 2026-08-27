import type { Branch, ExecutionVariant, FightMoveDefinition, FightStageName, OpeningKey, Position } from './types'

const stages = (contact: number, exchange: number, turn: number, finish: number): Record<FightStageName, number> => ({ contact, exchange, turn, finish })
const effects = (score: number, headDamage: number, bodyDamage: number, legDamage: number, control: number, staminaCost: number, finishPressure: number) =>
  ({ score, headDamage, bodyDamage, legDamage, control, staminaCost, finishPressure })

function move(
  id: string, label: string, description: string, positions: Position[], branch: Branch,
  category: FightMoveDefinition['category'], stageWeights: Record<FightStageName, number>,
  vector: ReturnType<typeof effects>, extras: Partial<FightMoveDefinition> = {},
): FightMoveDefinition {
  return { id, label, description, positions, branch, category, stageWeights, effects: vector, basic: true, creates: [], exploits: [], ...extras }
}

/** Every legal positional action lives here. The engine ranks this full pool instead of enforcing branch diversity. */
export const FIGHT_INTENTS: FightMoveDefinition[] = [
  move('probe-range', '試探距離', '低風險讀取防守，替下一招留下反應。', ['range'], 'boxing', 'offense', stages(10, 4, 3, 1), effects(5, 2, 0, 0, 0, 3, 1), { creates: ['high-guard'] }),
  move('steady-output', '穩定輸出', '以直線拳腳累積有效打擊。', ['range'], 'boxing', 'offense', stages(8, 8, 5, 6), effects(8, 4, 2, 0, 0, 5, 3), { creates: ['high-guard'] }),
  move('attack-body', '攻擊軀幹', '把注意力轉向肋部與腹部。', ['range', 'pocket'], 'boxing', 'offense', stages(5, 10, 8, 7), effects(8, 0, 9, 0, 0, 6, 4), { exploits: ['high-guard'], creates: ['tight-elbows'] }),
  move('damage-base', '破壞支撐腳', '用低掃削弱移動與平衡。', ['range', 'pocket'], 'kicking', 'offense', stages(7, 9, 8, 5), effects(7, 0, 1, 9, 0, 7, 4), { exploits: ['lead-leg-heavy'], creates: ['off-balance'] }),
  move('quick-entry', '快速進場', '用假動作或拳路縮短距離。', ['range'], 'wrestling', 'transition', stages(9, 7, 5, 4), effects(4, 1, 1, 0, 4, 6, 2), { cleanPosition: 'clinch', contestedPosition: 'pocket', exploits: ['weight-forward'], creates: ['backed-to-cage'] }),
  move('shot-entry', '抱摔切入', '改變高度並攻向雙腿或抱腰。', ['range', 'pocket'], 'wrestling', 'transition', stages(6, 9, 8, 5), effects(6, 0, 1, 0, 10, 9, 6), { cleanPosition: 'top', contestedPosition: 'clinch', counteredPosition: 'bottom', exploits: ['weight-forward', 'expects-shot'] }),
  move('angle-away', '切角脫離', '離開對手正面並重設距離。', ['range', 'pocket'], 'boxing', 'defense', stages(7, 5, 8, 9), effects(3, 0, 0, 0, 1, 2, 0), { cleanPosition: 'range', defensive: true, creates: ['weight-forward'] }),
  move('risky-power', '冒險重擊', '犧牲防守尋求一次重創。', ['range', 'pocket', 'cage'], 'boxing', 'offense', stages(1, 5, 7, 11), effects(10, 14, 2, 0, 0, 12, 13), { counteredPosition: 'pocket', exploits: ['neck-exposed', 'high-guard'] }),

  move('quick-combination', '快速組合', '以短促連拳搶在對手回擊前完成交換。', ['pocket'], 'boxing', 'offense', stages(7, 11, 8, 8), effects(10, 7, 3, 0, 0, 7, 6), { creates: ['high-guard'] }),
  move('counter-pressure', '迎擊壓迫', '抓住對手向前的一刻截擊。', ['pocket'], 'boxing', 'offense', stages(5, 9, 11, 7), effects(10, 9, 1, 0, 0, 6, 9), { exploits: ['weight-forward'], creates: ['off-balance'] }),
  move('drive-back', '逼退連打', '連續前進，把對手推向鐵網。', ['pocket'], 'boxing', 'offense', stages(4, 10, 8, 9), effects(10, 6, 3, 1, 4, 10, 7), { cleanPosition: 'cage', creates: ['backed-to-cage'] }),
  move('head-power', '重擊頭部', '以重拳尋找頭部防守空隙。', ['pocket', 'cage'], 'boxing', 'offense', stages(2, 7, 9, 11), effects(9, 12, 0, 0, 0, 10, 12), { exploits: ['neck-exposed', 'tight-elbows'] }),
  move('anti-shot-uppercut', '防抱摔上鉤', '預判變換高度，以短上鉤截住進腿。', ['pocket'], 'boxing', 'defense', stages(4, 8, 11, 6), effects(9, 10, 0, 0, 2, 7, 9), { exploits: ['expects-shot', 'weight-forward'], creates: ['neck-exposed'] }),
  move('enter-clinch', '進入纏抱', '關閉打擊空間，搶奪上身控制。', ['pocket'], 'clinch', 'transition', stages(6, 8, 8, 5), effects(4, 0, 1, 0, 7, 5, 2), { cleanPosition: 'clinch', contestedPosition: 'clinch', creates: ['expects-shot'] }),
  move('level-change', '變換高度', '用摔法假動作迫使對手壓低雙手。', ['pocket'], 'wrestling', 'transition', stages(9, 8, 10, 4), effects(3, 0, 1, 0, 2, 4, 1), { creates: ['expects-shot', 'high-guard'] }),
  move('low-kick-pocket', '近身低掃', '在拳擊交換尾端踢向前腳。', ['pocket'], 'kicking', 'offense', stages(4, 9, 8, 6), effects(7, 0, 0, 10, 0, 7, 4), { creates: ['off-balance'], counteredPosition: 'bottom' }),

  move('frame-space', '撐開空間', '用頭位與前臂重建可呼吸的空間。', ['clinch'], 'clinch', 'defense', stages(7, 6, 9, 9), effects(3, 0, 0, 0, 3, 3, 0), { cleanPosition: 'pocket', defensive: true }),
  move('inside-position', '搶內側位置', '爭取雙內勾與頭位。', ['clinch', 'cage'], 'clinch', 'transition', stages(8, 9, 10, 7), effects(4, 0, 0, 0, 8, 5, 3), { creates: ['backed-to-cage'] }),
  move('clinch-knees', '膝擊軀幹', '控制頭位，以膝擊消耗軀幹。', ['clinch', 'cage'], 'clinch', 'offense', stages(4, 10, 8, 8), effects(8, 1, 11, 0, 4, 8, 6), { exploits: ['hips-flat'], creates: ['tight-elbows'] }),
  move('short-elbows', '短肘', '在狹窄空間以短肘切開防線。', ['clinch', 'cage'], 'clinch', 'offense', stages(3, 9, 9, 11), effects(9, 11, 1, 0, 2, 8, 10), { exploits: ['tight-elbows'], creates: ['high-guard'] }),
  move('body-lock-control', '抱腰控制', '鎖住腰部，先讓對手無法自由轉身。', ['clinch', 'cage'], 'wrestling', 'transition', stages(6, 8, 10, 8), effects(4, 0, 1, 0, 10, 6, 3), { creates: ['hips-flat', 'backed-to-cage'] }),
  move('clinch-throw', '貼身摔投', '利用上身控制與支撐腳完成摔投。', ['clinch'], 'wrestling', 'transition', stages(3, 8, 11, 8), effects(8, 2, 4, 0, 12, 10, 8), { cleanPosition: 'top', contestedPosition: 'scramble', counteredPosition: 'bottom', exploits: ['off-balance', 'hips-flat'] }),
  move('pull-guard', '拉防守', '主動帶進下位，用防守架換取地戰入口。', ['clinch', 'cage'], 'ground', 'transition', stages(4, 6, 8, 5), effects(1, 0, 0, 0, 3, 5, 4), { cleanPosition: 'bottom', contestedPosition: 'bottom', counteredPosition: 'bottom', creates: ['arm-isolated'] }),
  move('turn-to-cage', '轉向籠邊', '以頭位與內勾把對手轉到鐵網。', ['clinch'], 'clinch', 'transition', stages(5, 7, 10, 8), effects(4, 0, 0, 0, 8, 6, 2), { cleanPosition: 'cage', creates: ['backed-to-cage'] }),

  move('cage-barrage', '封鎖連打', '封住左右出口後連續打擊。', ['cage'], 'boxing', 'offense', stages(3, 9, 9, 12), effects(11, 8, 4, 0, 4, 11, 10), { exploits: ['backed-to-cage'], creates: ['high-guard'] }),
  move('head-control', '頭位控制', '用頭與肩固定對手姿勢。', ['cage'], 'clinch', 'transition', stages(7, 8, 10, 8), effects(4, 0, 1, 0, 10, 5, 2), { creates: ['hips-flat'] }),
  move('wall-takedown', '籠邊抱摔', '固定在鐵網後改變摔法方向。', ['cage'], 'wrestling', 'transition', stages(3, 8, 11, 9), effects(8, 1, 3, 0, 13, 9, 8), { cleanPosition: 'top', contestedPosition: 'scramble', exploits: ['backed-to-cage', 'hips-flat'] }),
  move('turn-off-cage', '轉身脫離', '用內勾轉出鐵網，回到中央。', ['cage'], 'clinch', 'defense', stages(5, 7, 10, 11), effects(3, 0, 0, 0, 3, 4, 0), { cleanPosition: 'range', contestedPosition: 'clinch', defensive: true }),
  move('cover-cage', '護頭撐過', '收緊防線，承受較小代價等待鐘聲。', ['cage'], 'boxing', 'defense', stages(2, 4, 8, 13), effects(2, 0, 0, 0, 1, 1, 0), { defensive: true }),

  move('top-control', '穩固控制', '先壓平髖部，不急著進攻。', ['top'], 'ground', 'defense', stages(6, 8, 10, 12), effects(4, 0, 0, 0, 11, 3, 1), { creates: ['hips-flat'], defensive: true }),
  move('ground-strikes', '地面打擊', '在上位用短拳與肘累積傷害。', ['top'], 'ground', 'offense', stages(3, 9, 10, 12), effects(10, 9, 4, 0, 6, 8, 10), { exploits: ['hips-flat'], creates: ['high-guard'] }),
  move('improve-position', '改善位置', '越過防守架，尋找更穩定的上位。', ['top'], 'ground', 'transition', stages(5, 9, 11, 8), effects(5, 0, 0, 0, 12, 7, 5), { exploits: ['hips-flat'], creates: ['arm-isolated'] }),
  move('pass-guard', '過腿', '越過腿部防線，壓向側控。', ['top'], 'ground', 'transition', stages(3, 9, 12, 9), effects(6, 0, 1, 0, 13, 8, 6), { creates: ['arm-isolated', 'neck-exposed'] }),
  move('isolate-arm', '孤立手臂', '用膝與手控制一側手臂。', ['top'], 'ground', 'transition', stages(3, 8, 12, 10), effects(5, 0, 0, 0, 10, 7, 8), { creates: ['arm-isolated'] }),
  move('seek-choke', '尋找絞技', '繞過手臂，攻擊裸露頸部。', ['top'], 'ground', 'offense', stages(1, 6, 10, 13), effects(6, 0, 0, 0, 8, 9, 15), { submission: true, exploits: ['neck-exposed', 'arm-isolated'] }),
  move('stand-reset', '站起重置', '放棄上位，回到熟悉的站立。', ['top'], 'boxing', 'defense', stages(4, 5, 8, 9), effects(2, 0, 0, 0, -2, 2, 0), { cleanPosition: 'range', defensive: true }),
  move('deny-stand', '阻止起身', '壓住髖部，把對手重新拉回地面。', ['top'], 'wrestling', 'defense', stages(4, 7, 11, 11), effects(4, 0, 0, 0, 12, 7, 3), { exploits: ['hips-flat'], creates: ['hips-flat'], defensive: true }),

  move('rebuild-guard', '重建防守架', '恢復腿部框架，阻止對手壓近。', ['bottom'], 'ground', 'defense', stages(8, 8, 11, 12), effects(2, 0, 0, 0, 3, 3, 0), { defensive: true, creates: ['arm-isolated'] }),
  move('hip-escape', '髖部逃脫', '移動髖部創造起身或重建防守的空間。', ['bottom'], 'ground', 'transition', stages(6, 9, 11, 9), effects(3, 0, 0, 0, 5, 5, 1), { contestedPosition: 'scramble', creates: ['off-balance'] }),
  move('wall-walk', '貼籠起身', '以鐵網為支點逐步回到站立。', ['bottom'], 'ground', 'transition', stages(4, 8, 11, 12), effects(4, 0, 0, 0, 6, 8, 1), { cleanPosition: 'cage', contestedPosition: 'scramble' }),
  move('wrestle-up', '抱腿起身', '利用對手前傾抱腿並回到混戰。', ['bottom'], 'wrestling', 'transition', stages(4, 8, 12, 9), effects(5, 0, 0, 0, 8, 8, 4), { cleanPosition: 'top', contestedPosition: 'scramble', exploits: ['weight-forward'] }),
  move('guard-sweep', '掃摔', '破壞上位平衡並翻轉位置。', ['bottom'], 'ground', 'transition', stages(2, 8, 12, 10), effects(7, 0, 1, 0, 12, 9, 7), { cleanPosition: 'top', contestedPosition: 'scramble', creates: ['off-balance'] }),
  move('bottom-submission', '降服反攻', '以雙腿與髖部攻擊手臂或頸部。', ['bottom'], 'ground', 'offense', stages(2, 7, 11, 13), effects(6, 0, 0, 0, 6, 10, 16), { submission: true, exploits: ['arm-isolated', 'neck-exposed'] }),
  move('bottom-strikes', '下位打擊', '用短肘與腳跟迫使對手抬頭。', ['bottom'], 'ground', 'offense', stages(3, 7, 8, 8), effects(5, 4, 2, 0, 0, 5, 2), { creates: ['neck-exposed'] }),
  move('safe-bottom', '保守防守', '封住危險角度，避免被終結。', ['bottom'], 'ground', 'defense', stages(3, 5, 9, 13), effects(1, 0, 0, 0, 2, 2, 0), { defensive: true }),

  move('scramble-top', '搶上位', '先控制髖部，讓混戰倒向自己。', ['scramble'], 'wrestling', 'transition', stages(5, 9, 12, 10), effects(6, 0, 1, 0, 11, 8, 5), { cleanPosition: 'top', contestedPosition: 'clinch' }),
  move('scramble-stand', '脫離站起', '放棄纏鬥，先把雙腳站穩。', ['scramble'], 'wrestling', 'defense', stages(7, 7, 10, 11), effects(3, 0, 0, 0, 2, 5, 0), { cleanPosition: 'range', defensive: true }),
  move('take-back', '奪背', '繞到身後建立背部控制。', ['scramble'], 'ground', 'transition', stages(2, 8, 12, 11), effects(7, 0, 0, 0, 13, 9, 10), { cleanPosition: 'top', creates: ['neck-exposed'] }),
  move('front-headlock', '前頸控制', '壓住頭頸，阻止對手完成進腿。', ['scramble'], 'ground', 'offense', stages(4, 9, 12, 11), effects(6, 0, 1, 0, 10, 8, 12), { submission: true, creates: ['neck-exposed'] }),
  move('scramble-wall', '貼籠起身', '朝鐵網移動，利用支點站起。', ['scramble'], 'wrestling', 'transition', stages(6, 8, 10, 11), effects(3, 0, 0, 0, 5, 5, 0), { cleanPosition: 'cage' }),
  move('base-balance', '穩住重心', '停止搶攻，先避免倒向下位。', ['scramble'], 'wrestling', 'defense', stages(5, 7, 11, 12), effects(2, 0, 0, 0, 5, 3, 0), { defensive: true }),
]

const variant = (id: string, intentId: string, name: string, preview: string, extras: Partial<ExecutionVariant> = {}): ExecutionVariant => ({ id, intentId, name, preview, ...extras })

export const EXECUTION_VARIANTS: ExecutionVariant[] = [
  variant('base-probe', 'probe-range', '刺拳測距', '左刺拳碰觸防線，橫移讀取反應'),
  variant('boxer-quick-combo', 'quick-combination', '雙刺拳接後手直拳', '雙刺拳固定視線，再送出後手直拳', { backgrounds: ['boxing'] }),
  variant('base-quick-combo', 'quick-combination', '一二連拳', '左直拳掩護，後手直拳穿過中線'),
  variant('boxer-body', 'attack-body', '刺拳掩護肝臟勾拳', '先把雙手引高，再以右勾拳鑽向肋部', { backgrounds: ['boxing'], creates: ['tight-elbows'] }),
  variant('thai-body', 'attack-body', '直拳接左中掃', '用直拳固定站姿，再把脛骨送進軀幹', { backgrounds: ['muay-thai'], branch: 'kicking' }),
  variant('base-body', 'attack-body', '直拳接身體拳', '以直拳遮住視線，再轉打軀幹'),
  variant('thai-drive', 'drive-back', '刺拳、後手直拳接低掃', '兩拳迫使後退，再以低掃封住出口', { backgrounds: ['muay-thai'] }),
  variant('boxer-drive', 'drive-back', '雙刺拳、後手直拳接左勾拳', '用雙刺拳逼退，後手直拳與左勾拳封住出口', { backgrounds: ['boxing'] }),
  variant('base-drive', 'drive-back', '一二連拳逼退', '連續直拳搶佔正面，把對手推向鐵網'),
  variant('wrestler-entry', 'quick-entry', '一二連拳掩護抱腰', '用一二連拳抬高防守，隨即貼身抱腰', { backgrounds: ['wrestling'] }),
  variant('bjj-clinch', 'enter-clinch', '手腕控制接拉防守', '控制手腕關閉空間，準備拉防守或繞背', { backgrounds: ['bjj'] }),
  variant('base-entry', 'quick-entry', '變換節奏快速貼近', '用假動作凍結腳步，再快速關閉距離'),
  variant('base-shot', 'shot-entry', '雙腿抱摔', '壓低重心切入雙腿，轉角完成抱摔'),
  variant('chain-shot', 'shot-entry', '雙腿轉單腿連鎖摔', '第一下被擋便轉抱單腿，沿鐵網完成摔法', { unlockKey: 'chain-wrestle' }),
  variant('base-lowkick', 'damage-base', '外側低掃', '以拳路掩護外側低掃，破壞前腳'),
  variant('kick-flow', 'damage-base', '高低變線低掃', '先抬高踢擊視線，再突然改踢支撐腳', { unlockKey: 'kick-flow' }),
  variant('haymaker', 'risky-power', '重擺拳', '沉肩蓄力，以大弧線重拳尋求終結', { unlockKey: 'haymaker', effectBonus: { headDamage: 5, finishPressure: 5 } }),
  variant('superman', 'risky-power', '超人拳', '抬膝假裝踢擊，再躍進送出後手直拳', { unlockKey: 'superman-punch', branch: 'kicking' }),
  variant('base-power', 'risky-power', '後手重拳', '用前手固定視線，再全力送出後手重拳'),
  variant('base-counter', 'counter-pressure', '後手直拳迎擊', '後撤半步，讓後手直拳撞上前進路線'),
  variant('cross-counter', 'counter-pressure', '拉閃後手迎擊', '頭部後拉避開前手，立即以後手重拳回敬', { unlockKey: 'cross-counter' }),
  variant('base-head', 'head-power', '右直拳接左勾拳', '直拳穿過中線，再以左勾拳繞過防守'),
  variant('base-clinch', 'enter-clinch', '雙內勾進入纏抱', '額頭頂住下巴，雙手搶入內側位置'),
  variant('base-frame', 'frame-space', '前臂框架', '以前臂頂住鎖骨，重建呼吸空間'),
  variant('base-knee', 'clinch-knees', '頭位控制接膝擊', '拉低上身，以膝蓋撞向腹部'),
  variant('base-elbow', 'short-elbows', '近身短肘', '內勾固定肩線，短肘穿過防守'),
  variant('base-throw', 'clinch-throw', '內圍絆摔', '上身轉向同時勾開支撐腳'),
  variant('base-pull', 'pull-guard', '腕控拉防守', '控制手腕坐向髖下，把對手帶進封閉防守'),
  variant('base-cage-combo', 'cage-barrage', '刺拳直拳接雙勾拳', '刺拳封路，直拳與雙勾拳沿鐵網追擊'),
  variant('cage-combo', 'cage-barrage', '籠邊六拳連擊', '封死兩側出口後，以頭身變線連續出拳', { unlockKey: 'cage-combo' }),
  variant('base-wall-shot', 'wall-takedown', '籠邊雙腿抱摔', '頭位壓向下巴，轉角抱起雙腿'),
  variant('base-ground-strikes', 'ground-strikes', '上位短拳與肘擊', '壓住髖部後，以短拳和肘擊打開防守'),
  variant('crucifix', 'ground-strikes', '十字架肘擊', '用雙腿固定手臂，在十字架位置連續落肘', { unlockKey: 'crucifix', effectBonus: { control: 4, finishPressure: 5 } }),
  variant('base-pass', 'pass-guard', '切膝過腿', '壓住膝線，以切膝滑向側控'),
  variant('base-choke', 'seek-choke', '手臂三角絞', '把手臂壓過中線，收緊頸部空間'),
  variant('sub-hunter-choke', 'seek-choke', '達斯絞', '趁頸部暴露穿臂鎖緊，沿角度收束', { unlockKey: 'style-submission' }),
  variant('base-bottom-sub', 'bottom-submission', '三角鎖反攻', '把一側手臂拉過中線，雙腿鎖住頸部'),
  variant('base-sweep', 'guard-sweep', '剪式掃摔', '控制手臂與膝部，剪開重心翻到上位'),
  variant('base-takeback', 'take-back', '繞背奪位', '避開頭位，從側面繞到背後建立控制'),
  variant('base-fronthead', 'front-headlock', '前頸鎖控', '壓低頭部，以腋下控制頸部與手臂'),
]

/** Explicit consumption map: every tech unlock key affects a variant, intent, or passive recommendation/effect rule. */
export const TECHNIQUE_COMBAT_RULES: Record<string, { intents: string[]; bonus: number; note: string }> = {
  'jab-exit': { intents: ['probe-range', 'angle-away'], bonus: 7, note: '刺拳後切角更穩定' },
  'body-work': { intents: ['attack-body'], bonus: 9, note: '軀幹攻擊效果提升' },
  'cross-counter': { intents: ['counter-pressure'], bonus: 9, note: '迎擊效率提升' },
  'cage-combo': { intents: ['cage-barrage', 'drive-back'], bonus: 9, note: '籠邊連打延長攻勢' },
  haymaker: { intents: ['risky-power', 'head-power'], bonus: 8, note: '解鎖重擺拳' },
  'volume-trap': { intents: ['quick-combination', 'drive-back'], bonus: 8, note: '重複拳路較不易被適應' },
  'low-kick': { intents: ['damage-base', 'low-kick-pocket'], bonus: 8, note: '低掃失衡風險降低' },
  'front-kick': { intents: ['angle-away', 'steady-output'], bonus: 7, note: '前踢控距更省力' },
  'body-kick': { intents: ['attack-body'], bonus: 8, note: '重踢軀幹' },
  'superman-punch': { intents: ['risky-power', 'quick-entry'], bonus: 8, note: '解鎖超人拳' },
  'high-kick': { intents: ['head-power'], bonus: 9, note: '軀幹受創後可高踢收尾' },
  'kick-flow': { intents: ['damage-base', 'steady-output'], bonus: 8, note: '踢擊變線降低適應' },
  'clinch-frame': { intents: ['frame-space'], bonus: 9, note: '框架防守提升' },
  'clinch-knee': { intents: ['clinch-knees'], bonus: 8, note: '膝擊軀幹提升' },
  underhook: { intents: ['inside-position', 'turn-off-cage'], bonus: 9, note: '內勾爭位提升' },
  'short-elbow': { intents: ['short-elbows'], bonus: 9, note: '短肘終結壓力提升' },
  'clinch-trip': { intents: ['clinch-throw'], bonus: 9, note: '貼身絆摔提升' },
  'clinch-grind': { intents: ['body-lock-control', 'head-control'], bonus: 8, note: '控制額外消耗對手體力' },
  sprawl: { intents: ['anti-shot-uppercut', 'base-balance'], bonus: 8, note: '防摔反應提升' },
  'double-leg': { intents: ['shot-entry'], bonus: 9, note: '雙腿抱摔提升' },
  'chain-wrestle': { intents: ['shot-entry', 'scramble-top'], bonus: 9, note: '摔法遭擋後可連鎖' },
  'wall-takedown': { intents: ['wall-takedown'], bonus: 9, note: '籠邊抱摔提升' },
  'mat-return': { intents: ['deny-stand'], bonus: 9, note: '阻止起身提升' },
  'wrestle-pressure': { intents: ['shot-entry', 'quick-entry'], bonus: 8, note: '連續進腿的重複懲罰降低' },
  'top-posture': { intents: ['top-control', 'ground-strikes'], bonus: 8, note: '上位更穩定' },
  'closed-guard': { intents: ['rebuild-guard', 'pull-guard'], bonus: 8, note: '防守架更加穩定' },
  'wall-walk': { intents: ['wall-walk', 'scramble-wall'], bonus: 9, note: '貼籠起身提升' },
  crucifix: { intents: ['ground-strikes', 'isolate-arm'], bonus: 9, note: '解鎖十字架控制' },
  'bottom-submission': { intents: ['bottom-submission'], bonus: 10, note: '下位降服提升' },
  'position-hunter': { intents: ['improve-position', 'pass-guard', 'isolate-arm'], bonus: 8, note: '轉位與控位提升' },
  'style-range': { intents: ['probe-range', 'angle-away', 'counter-pressure'], bonus: 8, note: '遠距反擊協同' },
  'style-pressure': { intents: ['drive-back', 'quick-entry', 'enter-clinch'], bonus: 8, note: '跨距離壓迫協同' },
  'style-cage': { intents: ['inside-position', 'wall-takedown', 'cage-barrage'], bonus: 8, note: '籠邊控制協同' },
  'style-sprawl': { intents: ['anti-shot-uppercut', 'counter-pressure'], bonus: 8, note: '防摔後立即拳擊反擊' },
  'style-ground-pound': { intents: ['shot-entry', 'ground-strikes'], bonus: 8, note: '抱摔接地面打擊' },
  'style-submission': { intents: ['front-headlock', 'seek-choke', 'bottom-submission'], bonus: 8, note: '轉位時更易捕捉降服' },
}

export const OPENING_LABELS: Record<OpeningKey, string> = {
  'high-guard': '防守抬高', 'tight-elbows': '肘部收窄', 'weight-forward': '重心前傾',
  'lead-leg-heavy': '重心落在前腳', 'expects-shot': '預期抱摔', 'backed-to-cage': '背靠籠網',
  'off-balance': '姿勢失衡', 'neck-exposed': '頸部暴露', 'arm-isolated': '手臂被孤立', 'hips-flat': '髖部被壓平',
}

export function variantsForIntent(intentId: string): ExecutionVariant[] {
  return EXECUTION_VARIANTS.filter((item) => item.intentId === intentId)
}
