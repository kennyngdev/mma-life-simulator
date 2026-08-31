import { z } from 'zod'
import type { Branch, Motive, Region, RegionProfile, TechniqueNode } from './types'

export const REGION_LABELS: Record<Region, string> = {
  'hong-kong': '香港',
  taiwan: '台灣',
  mainland: '中國大陸',
}

export const MOTIVES: Record<Motive, { name: string; description: string }> = {
  family: { name: '為家人而戰', description: '你最在意的是收入和對家人的承諾，不是名氣。' },
  prove: { name: '證明自己', description: '越是被看衰，你越想打一場讓人閉嘴的比賽。' },
  honor: { name: '守住拳館', description: '教練、隊友和拳館的招牌，都比個人得失重要。' },
  fame: { name: '站上聚光燈', description: '你想打出名堂，接下最受矚目的比賽。' },
}

export const BRANCH_META: Record<Branch, { name: string; short: string; accent: string }> = {
  boxing: { name: '拳擊', short: '拳', accent: '#e45c3b' },
  kicking: { name: '踢擊', short: '踢', accent: '#d69335' },
  clinch: { name: '纏抱', short: '抱', accent: '#3f9e92' },
  wrestling: { name: '摔投', short: '摔', accent: '#5b82c6' },
  ground: { name: '地戰', short: '地', accent: '#8f67b6' },
}

export const TECHNIQUE_AFFINITIES: Array<{ from: Branch; to: Branch; label: string; bonus: number; hybridNode?: string }> = [
  { from: 'boxing', to: 'kicking', label: '拳路迫使防守抬高，踢擊趁隙進入', bonus: 7, hybridNode: 'hybrid-range' },
  { from: 'kicking', to: 'boxing', label: '踢擊牽制重心，拳路接續命中', bonus: 6, hybridNode: 'hybrid-pressure' },
  { from: 'boxing', to: 'wrestling', label: '拳擊掩護變換高度', bonus: 6 },
  { from: 'kicking', to: 'clinch', label: '踢擊迫使對手收窄站姿', bonus: 5, hybridNode: 'hybrid-pressure' },
  { from: 'clinch', to: 'wrestling', label: '上身控制接續摔投', bonus: 8, hybridNode: 'hybrid-cage' },
  { from: 'wrestling', to: 'clinch', label: '抱摔威脅讓內勾更容易建立', bonus: 5, hybridNode: 'hybrid-cage' },
  { from: 'wrestling', to: 'ground', label: '抱摔落地直接銜接地面控制', bonus: 9, hybridNode: 'hybrid-ground-pound' },
  { from: 'ground', to: 'wrestling', label: '地面轉位創造重新站起或掃摔的角度', bonus: 5, hybridNode: 'hybrid-sub-hunter' },
]

export const BACKGROUNDS: Array<{
  id: string
  name: string
  description: string
  primary: Branch
  secondary: Branch
  startingNodes?: [string, string]
  startingMoves?: string[]
}> = [
  { id: 'boxing', name: '業餘拳擊手', description: '腳步扎實，出拳俐落，但一被拖到地面就無所適從。', primary: 'boxing', secondary: 'clinch', startingMoves: ['jab-cross'] },
  { id: 'sanda', name: '散打校隊', description: '你會踢、會打，也熟悉接腿後的摔法。', primary: 'kicking', secondary: 'wrestling', startingMoves: ['catch-kick-sweep'] },
  { id: 'muay-thai', name: '泰拳館少年', description: '你不怕近身硬拚，通常會用膝和肘回敬對手。', primary: 'kicking', secondary: 'clinch', startingMoves: ['clinch-short-knee'] },
  { id: 'wrestling', name: '自由式摔跤選手', description: '壓低重心、連續進腿和控制對手已成習慣；現在該學的是站立打擊與降服。', primary: 'wrestling', secondary: 'ground', startingNodes: ['wrestle-sprawl', 'wrestle-double'], startingMoves: ['shot-entry'] },
  { id: 'judo', name: '柔道黑帶新秀', description: '你很會讓對手失去平衡，但沒有道服可抓時，一切都得重新適應。', primary: 'clinch', secondary: 'wrestling', startingMoves: ['clinch-throw'] },
  { id: 'bjj', name: '巴西柔術選手', description: '你熟悉防守架、轉位與各種降服；難的是如何先把對手拖到地面。', primary: 'ground', secondary: 'wrestling', startingNodes: ['ground-posture', 'ground-guard'], startingMoves: ['guard-kimura'] },
]

export const WEIGHT_CLASSES = [
  { name: '雛量級', limit: 61.2 },
  { name: '羽量級', limit: 65.8 },
  { name: '輕量級', limit: 70.3 },
  { name: '次中量級', limit: 77.1 },
  { name: '中量級', limit: 83.9 },
  { name: '輕重量級', limit: 93 },
] as const

export const REGION_PROFILES: Record<Region, RegionProfile> = {
  'hong-kong': {
    label: '香港', circuit: '國際門戶',
    description: '商業曝光多、外來拳手也多。地方收入較高，但醫療與生活成本同樣更高。',
    opponentMix: '約 50% 香港 · 25% 鄰近地區 · 25% 亞洲來客', opponentMixWeights: { home: 50, neighbor: 25, asianVisitor: 25 }, economyLabel: '高收入／高成本', economyMultiplier: 1.15,
    currency: { symbol: 'HK$', displayRate: 0.25, rounding: 10 },
    hometowns: ['九龍', '港島', '新界', '荃灣', '沙田'],
    identities: [
      { name: '陳家朗', alias: 'Ka-long Chan' }, { name: '梁卓賢', alias: 'Cheuk-yin Leung' },
      { name: '黃俊熙', alias: 'Chun-hei Wong' }, { name: '何柏謙', alias: 'Pak-him Ho' },
      { name: '鄧梓峰', alias: 'Tsz-fung Tang' }, { name: '郭天佑', alias: 'Tin-yau Kwok' },
      { name: '周浩文', alias: 'Ho-man Chow' }, { name: '羅逸朗', alias: 'Yat-long Law' },
      { name: '許樂軒', alias: 'Lok-hin Hui' }, { name: '馮啟文', alias: 'Kai-man Fung' },
      { name: '葉駿謙', alias: 'Chun-him Yip' }, { name: '蘇志恆', alias: 'Chi-hang So' },
      { name: '潘偉霆', alias: 'Wai-ting Poon' }, { name: '馬朗賢', alias: 'Long-yin Ma' },
      { name: '杜皓文', alias: 'Ho-man To' }, { name: '謝晉希', alias: 'Chun-hei Tse' },
      { name: '李諾言', alias: 'Lok-yin Lee' }, { name: '張子健', alias: 'Tsz-kin Cheung' },
      { name: '劉文皓', alias: 'Man-ho Lau' }, { name: '蔡嘉俊', alias: 'Ka-chun Choi' },
      { name: '莫嘉熙', alias: 'Ka-hei Mok' }, { name: '鍾卓朗', alias: 'Cheuk-long Chung' },
      { name: '盧文謙', alias: 'Man-him Lo' }, { name: '曹晉軒', alias: 'Chun-hin Cho' },
      { name: '任柏言', alias: 'Pak-yin Yam' }, { name: '麥俊庭', alias: 'Chun-ting Mak' },
      { name: '黎皓然', alias: 'Ho-yin Lai' }, { name: '關逸峰', alias: 'Yat-fung Kwan' },
      { name: '溫啟豪', alias: 'Kai-ho Wan' }, { name: '石天樂', alias: 'Tin-lok Shek' },
      { name: '戴志朗', alias: 'Chi-long Tai' }, { name: '方家謙', alias: 'Ka-him Fong' },
    ],
    promotions: {
      grassroots: ['九龍拳館試煉', '維港週末對抗', '旺角籠鬥秀'],
      amateur: ['維港格鬥夜', '香港新秀聯賽'], regional: ['亞洲港口挑戰賽', '香江職業格鬥會'],
    },
  },
  taiwan: {
    label: '台灣', circuit: '拳館網絡',
    description: '地方拳館彼此熟識，對手與人情會反覆出現在你的生涯裡。收入與成本最穩定。',
    opponentMix: '約 65% 台灣 · 20% 鄰近地區 · 15% 亞洲來客', opponentMixWeights: { home: 65, neighbor: 20, asianVisitor: 15 }, economyLabel: '穩定收入／穩定成本', economyMultiplier: 1,
    currency: { symbol: 'NT$', displayRate: 1, rounding: 100 },
    hometowns: ['台北', '新北', '台中', '台南', '高雄'],
    identities: [
      { name: '林致遠' }, { name: '江冠廷' }, { name: '吳承恩' }, { name: '洪曜宇' },
      { name: '邱柏勳' }, { name: '曾品睿' }, { name: '廖彥廷' }, { name: '賴宇謙' },
      { name: '徐哲維' }, { name: '鄭奕翔' }, { name: '郭宗翰' }, { name: '楊秉宸' },
      { name: '許威廷' }, { name: '謝祐嘉' }, { name: '蔡凱翔' }, { name: '王昱辰' },
      { name: '張子翔' }, { name: '黃家豪' }, { name: '劉維哲' }, { name: '陳俊傑' },
      { name: '蘇柏翰' }, { name: '葉承叡' }, { name: '柯宇森' }, { name: '簡廷祐' },
      { name: '游皓翔' }, { name: '羅冠宇' }, { name: '彭致豪' }, { name: '范秉鈞' },
      { name: '顏哲安' }, { name: '戴育誠' }, { name: '高睿廷' }, { name: '沈品皓' },
    ],
    promotions: {
      grassroots: ['河濱拳館試煉', '廟口週末對抗', '南方格鬥秀'],
      amateur: ['島嶼格鬥夜', '城市拳館聯賽'], regional: ['海峽格鬥聯盟', '福爾摩沙職業賽'],
    },
  },
  mainland: {
    label: '中國大陸', circuit: '深度賽事',
    description: '城市賽事與跨城集訓密集，地方競爭最深。收入較低，但治療與生活成本也較低。',
    opponentMix: '約 75% 中國大陸 · 15% 鄰近地區 · 10% 亞洲來客', opponentMixWeights: { home: 75, neighbor: 15, asianVisitor: 10 }, economyLabel: '低收入／低成本', economyMultiplier: 0.85,
    currency: { symbol: '¥', displayRate: 0.22, rounding: 10 },
    hometowns: ['上海', '成都', '武漢', '西安', '廣州'],
    identities: [
      { name: '趙振東' }, { name: '孫宇航' }, { name: '高鵬飛' }, { name: '胡景程' },
      { name: '朱逸凡' }, { name: '宋文博' }, { name: '周澤宇' }, { name: '馬天宇' },
      { name: '羅承宇' }, { name: '何睿哲' }, { name: '王明軒' }, { name: '李凱文' },
      { name: '張昊然' }, { name: '劉博文' }, { name: '陳浩然' }, { name: '楊皓軒' },
      { name: '黃志遠' }, { name: '吳子軒' }, { name: '徐嘉豪' }, { name: '郭文昊' },
      { name: '鄭凱旋' }, { name: '馮宇辰' }, { name: '董睿航' }, { name: '袁景浩' },
      { name: '杜承澤' }, { name: '姜逸晨' }, { name: '唐世豪' }, { name: '魏子墨' },
      { name: '韓啟明' }, { name: '彭俊馳' }, { name: '程浩宇' }, { name: '石博遠' },
    ],
    promotions: {
      grassroots: ['城市俱樂部試煉', '街區週末對抗', '新秀格鬥秀'],
      amateur: ['全國新秀賽', '城市俱樂部聯賽'], regional: ['東方職業格鬥會', '跨城格鬥巡迴'],
    },
  },
}

export function formatRegionalMoney(value: number, region: Region): string {
  const { symbol, displayRate, rounding } = REGION_PROFILES[region].currency
  const converted = Math.round(value * displayRate / rounding) * rounding
  return `${symbol} ${converted.toLocaleString('zh-TW')}`
}

export const OPPONENT_NATIONALITIES: Record<Region, string> = {
  'hong-kong': '香港',
  taiwan: '台灣',
  mainland: '中國',
}

export const INTERNATIONAL_OPPONENTS: Array<{ name: string; nationality: string }> = [
  { name: 'Marco Silva', nationality: '巴西' },
  { name: 'Lucas Ferreira', nationality: '巴西' },
  { name: 'Rafael Nunes', nationality: '巴西' },
  { name: 'Thiago Almeida', nationality: '巴西' },
  { name: 'Ren Sato', nationality: '日本' },
  { name: 'Kenji Mori', nationality: '日本' },
  { name: 'Daichi Tanaka', nationality: '日本' },
  { name: 'Yuto Nakamura', nationality: '日本' },
  { name: 'Dae-Hyun Park', nationality: '南韓' },
  { name: 'Min-Jun Kim', nationality: '南韓' },
  { name: 'Ji-Ho Lee', nationality: '南韓' },
  { name: 'Seong-Hun Choi', nationality: '南韓' },
  { name: 'Arman Petrov', nationality: '俄羅斯' },
  { name: 'Mikhail Volkov', nationality: '俄羅斯' },
  { name: 'Timur Sadykov', nationality: '哈薩克' },
  { name: 'Azamat Bekov', nationality: '吉爾吉斯' },
  { name: 'Noah Williams', nationality: '美國' },
  { name: 'Eli Turner', nationality: '美國' },
  { name: 'Malik Johnson', nationality: '美國' },
  { name: 'Connor Hayes', nationality: '美國' },
  { name: 'Rafiq Hasan', nationality: '孟加拉' },
  { name: 'Arjun Mehta', nationality: '印度' },
  { name: 'Aditya Rao', nationality: '印度' },
  { name: 'Fahad Rahman', nationality: '巴基斯坦' },
  { name: 'Diego Costa', nationality: '葡萄牙' },
  { name: 'Tomas Varga', nationality: '匈牙利' },
  { name: 'Jakub Nowak', nationality: '波蘭' },
  { name: 'Mateo Ruiz', nationality: '西班牙' },
  { name: 'Omar Haddad', nationality: '黎巴嫩' },
  { name: 'Karim Mansour', nationality: '埃及' },
  { name: 'Youssef Amrani', nationality: '摩洛哥' },
  { name: 'Amir Hosseini', nationality: '伊朗' },
  { name: 'Somchai Kietchai', nationality: '泰國' },
  { name: 'Niran Saelim', nationality: '泰國' },
  { name: 'Anurak Boonmee', nationality: '泰國' },
  { name: 'Krit Srisuk', nationality: '泰國' },
  { name: 'Nguyen Minh Quan', nationality: '越南' },
  { name: 'Tran Duc Anh', nationality: '越南' },
  { name: 'Iko Pratama', nationality: '印尼' },
  { name: 'Dimas Saputra', nationality: '印尼' },
  { name: 'Aiman Iskandar', nationality: '馬來西亞' },
  { name: 'Farid Hakim', nationality: '馬來西亞' },
  { name: 'Liam O’Connor', nationality: '愛爾蘭' },
  { name: 'Callum Fraser', nationality: '英國' },
  { name: 'Jack Bennett', nationality: '澳洲' },
  { name: 'Wiremu Rangi', nationality: '紐西蘭' },
  { name: 'Bastien Moreau', nationality: '法國' },
  { name: 'Luca Romano', nationality: '義大利' },
]

function makeNode(
  id: string,
  name: string,
  branch: TechniqueNode['branch'],
  tier: 1 | 2 | 3,
  kind: TechniqueNode['kind'],
  description: string,
  effect: string,
  prerequisites: string[],
  unlockKey: string,
  extras: Partial<TechniqueNode> = {},
): TechniqueNode {
  return { id, name, branch, tier, cost: tier, kind, description, effect, prerequisites, unlockKey, ...extras }
}

export const TECHNIQUE_NODES: TechniqueNode[] = [
  makeNode('box-foot-jab', '刺拳切角', 'boxing', 1, 'foundation', '反覆練習刺拳與橫移，讓自己打中後能迅速離開正面。', '試探或切角沒有被破解時回到遠距，並收掉前傾空檔。', [], 'jab-exit'),
  makeNode('box-body-work', '重擊軀幹', 'boxing', 1, 'chain', '把拳頭送進對手的腹部與肋部，削弱後半場的體力。', '打中時會額外消耗對手體力。', ['box-foot-jab'], 'body-work'),
  makeNode('box-cross-counter', '後手迎擊', 'boxing', 2, 'response', '抓準對手逼近的時機，用後手重拳迎面截擊。', '受壓迫時可以反擊，趁機拉開距離。', ['box-foot-jab'], 'cross-counter', { evidence: { key: 'fights', amount: 2, label: '完成 2 場比賽' } }),
  makeNode('box-cage-combo', '籠邊連擊', 'boxing', 2, 'chain', '對手背靠鐵網時連續出拳，不給他喘息或逃走的機會。', '在籠邊打中後，可以繼續壓制對手。', ['box-body-work'], 'cage-combo'),
  makeNode('box-pull-counter', '重擺拳', 'boxing', 3, 'response', '先讓頭部離開中線，再把全身重量集中到弧線重拳。', '把基本重擺拳升級為傷害與終結壓力更高的拉閃反擊。', ['box-cross-counter'], 'haymaker', { evidence: { key: 'knockdowns', amount: 1, label: '生涯擊倒對手 1 次' }, tradeoff: '揮空會大量消耗體力，也會暴露反擊空間。' }),
  makeNode('box-volume-trap', '節奏變化', 'boxing', 3, 'style', '用固定節奏誘使對手習慣，再突然改變連擊的收尾。', '以拳擊為主攻時更加穩定，打滿回合也比較省力。', ['box-cage-combo', 'box-pull-counter'], 'volume-trap', { tradeoff: '出拳量增加，雙手也更容易受傷。' }),

  makeNode('kick-low', '低掃牽制', 'kicking', 1, 'foundation', '練好低掃的時機與重心，出腳時不再輕易失去平衡。', '乾淨低掃追加腿傷；近身低掃被破解時仍能站穩。', [], 'low-kick'),
  makeNode('kick-front', '前踢控距', 'kicking', 1, 'response', '反覆練習出腳時機，確保踢完後能穩穩站住。', '用前踢拉開距離時更加穩定，也比較省力。', ['kick-low'], 'front-kick'),
  makeNode('kick-body', '重踢軀幹', 'kicking', 2, 'chain', '先用拳吸引防守，再重踢對手的軀幹。', '軀幹傷害更高，後半場也更容易取得體力優勢。', ['kick-low'], 'body-kick', { evidence: { key: 'fights', amount: 2, label: '完成 2 場比賽' } }),
  makeNode('kick-catch-counter', '超人拳', 'kicking', 2, 'response', '用抬膝假動作讓對手預判踢擊，再突然躍進出拳。', '解鎖跨越遠距的超人拳，成功時能造成顯著傷害。', ['kick-front'], 'superman-punch'),
  makeNode('kick-high-setup', '高踢佈局', 'kicking', 3, 'chain', '先反覆攻擊軀幹，等對手降低防守後再踢向頭部。', '對手軀幹受創後，高踢終結的機會更大。', ['kick-body'], 'high-kick', { evidence: { key: 'knockdowns', amount: 1, label: '生涯擊倒對手 1 次' }, tradeoff: '一旦被看穿，可能遭到抱摔。' }),
  makeNode('kick-flow', '三路踢擊', 'kicking', 3, 'style', '在低、中、高三個位置之間靈活變換攻擊。', '對手更難只靠一種防守化解你的踢擊。', ['kick-catch-counter', 'kick-high-setup'], 'kick-flow', { tradeoff: '大量踢擊會加重膝腿負擔。' }),

  makeNode('clinch-frame', '框架防守', 'clinch', 1, 'foundation', '練好頭位與前臂支撐，在纏抱中替自己撐出空間。', '更容易撐開對手，從纏抱中脫身。', [], 'clinch-frame'),
  makeNode('clinch-knee', '近身膝擊', 'clinch', 1, 'chain', '控制住對手的頭位後，以膝擊持續傷害軀幹。', '乾淨命中額外削減體力，並延長對手收肘形成的空檔。', ['clinch-frame'], 'clinch-knee'),
  makeNode('clinch-underhook', '內勾爭位', 'clinch', 2, 'response', '用內勾配合頭位，重新奪回纏抱中的控制權。', '更容易搶到內勾，也更容易在籠邊與對手交換位置。', ['clinch-frame'], 'underhook', { evidence: { key: 'cageMinutes', amount: 2, label: '累積 2 分鐘籠邊控制' } }),
  makeNode('clinch-elbow', '近身短肘', 'clinch', 2, 'chain', '在狹窄空間用短肘切開防守，也可能劃傷對手。', '近身擊中時更有機會迫使裁判終止比賽。', ['clinch-knee'], 'short-elbow'),
  makeNode('clinch-trip', '內圍絆摔', 'clinch', 3, 'chain', '控制住對手的上半身，再看準時機絆開他的支撐腳。', '貼身絆摔更容易成功，摔倒對手後也能守穩上位。', ['clinch-underhook'], 'clinch-trip', { evidence: { key: 'takedowns', amount: 3, label: '完成 3 次抱摔' } }),
  makeNode('clinch-grind', '壓迫纏抱', 'clinch', 3, 'style', '每次纏抱都把重量壓在對手身上，慢慢耗掉他的力氣。', '籠邊控制更有效，也更能消耗對手體力。', ['clinch-elbow', 'clinch-trip'], 'clinch-grind', { tradeoff: '遠距離的進攻能力會成長得比較慢。' }),

  makeNode('wrestle-sprawl', '下壓防摔', 'wrestling', 1, 'response', '反覆練習髖部後撤與重心下壓，讓防摔成為本能反應。', '更容易擋住抱摔，成功後也能迅速拉開距離。', [], 'sprawl'),
  makeNode('wrestle-double', '雙腿抱摔', 'wrestling', 1, 'foundation', '改善壓低身體、切入的角度，以及抱住雙腿後的收尾。', '雙腿抱摔更容易成功，失敗時也比較不耗體力。', ['wrestle-sprawl'], 'double-leg'),
  makeNode('wrestle-chain', '連鎖摔法', 'wrestling', 2, 'chain', '第一個摔法被擋住後，立刻換方向接上另一招。', '每回合一次，把被破解的進腿接成纏抱，額外消耗 3 體力。', ['wrestle-double'], 'chain-wrestle', { evidence: { key: 'takedowns', amount: 2, label: '完成 2 次抱摔' } }),
  makeNode('wrestle-wall', '籠邊抱摔', 'wrestling', 2, 'chain', '用頭位和腰控壓住對手，再突然換方向將他摔倒。', '籠邊抱摔更容易成功，摔倒對手後也能守穩上位。', ['wrestle-double'], 'wall-takedown'),
  makeNode('wrestle-mat-return', '抱腰回摔', 'wrestling', 3, 'response', '對手試圖起身時繼續抱住腰部，再次將他摔回地面。', '更不容易失去上位控制。', ['wrestle-chain'], 'mat-return', { evidence: { key: 'takedowns', amount: 5, label: '完成 5 次抱摔' } }),
  makeNode('wrestle-pressure', '連續進腿', 'wrestling', 3, 'style', '一次又一次切入抱摔，逼得對手只能忙著防守。', '以摔法為主攻時，可以更頻繁地變換招式。', ['wrestle-wall', 'wrestle-mat-return'], 'wrestle-pressure', { tradeoff: '進腿一旦失敗，會消耗大量體力。' }),

  makeNode('ground-posture', '穩住上位', 'ground', 1, 'foundation', '練好髖部、頭位和平衡，在上位不再輕易被對手掀翻。', '上位控制更加穩定，也能更安全地出拳。', [], 'top-posture'),
  makeNode('ground-guard', '封閉式防守', 'ground', 1, 'response', '改善下位的防守架與腿部控制，必要時也能主動把對手拉進防守架。', '重建或拉防守被破解時，承傷最多 3 並留在下位。', ['ground-posture'], 'closed-guard'),
  makeNode('ground-escape', '籠邊起身', 'ground', 2, 'response', '反覆練習背靠鐵網起身，同時護住頭部避免挨打。', '貼籠起身更容易成功，過程中受到的傷害也會降低。', ['ground-guard'], 'wall-walk', { evidence: { key: 'bottomEscapes', amount: 1, label: '從下位脫困 1 次' } }),
  makeNode('ground-arm', '上位困臂', 'ground', 2, 'chain', '用膝線與手腕控制固定一側手臂，限制對手的防守選擇。', '上位困臂會提高隔離手臂與後續控位的穩定性。', ['ground-posture'], 'crucifix'),
  makeNode('ground-submission', '下位降服', 'ground', 3, 'response', '被壓制時，以三角鎖或十字固突然反攻。', '從下位嘗試降服時更容易成功，並能累積這項技術的精通。', ['ground-escape'], 'bottom-submission', { evidence: { key: 'bottomEscapes', amount: 2, label: '從下位脫困 2 次' }, tradeoff: '失敗時可能連防守位置都保不住。' }),
  makeNode('ground-hunter', '控位獵手', 'ground', 3, 'style', '不急著收尾，先一步步封死對手的每條退路。', '在上位轉換位置與連接降服時更加穩定。', ['ground-arm', 'ground-submission'], 'position-hunter', { tradeoff: '只顧著控制，可能因進攻不夠積極而輸掉回合。' }),

  makeNode('hybrid-range', '遠距反擊', 'hybrid', 3, 'style', '結合刺拳的腳步與前踢的控距，在外圍誘使對手撲空。', '保持距離時，反擊和脫身都更有效率。', ['box-cross-counter', 'kick-front'], 'style-range', { tradeoff: '不擅長主動追趕後退的對手。' }),
  makeNode('hybrid-pressure', '全距壓迫', 'hybrid', 3, 'style', '從踢擊一路逼近到纏抱，不給對手任何安全距離。', '無論距離如何變化，都能繼續向前施壓。', ['kick-body', 'clinch-knee'], 'style-pressure', { tradeoff: '整場維持壓迫會消耗更多體力。' }),
  makeNode('hybrid-cage', '籠邊壓制', 'hybrid', 3, 'style', '用上半身控制配合籠邊摔法，一步步封死對手的選擇。', '在籠邊可以順暢連接控制、打擊與摔法。', ['clinch-underhook', 'wrestle-wall'], 'style-cage', { tradeoff: '回到場中央後，站立攻防會比較笨重。' }),
  makeNode('hybrid-sprawl', '防摔拳手', 'hybrid', 3, 'style', '靠紮實的防摔把比賽留在站立，繼續發揮拳擊優勢。', '防摔成功後，可以立刻接上拳擊反擊。', ['box-body-work', 'wrestle-sprawl'], 'style-sprawl', { tradeoff: '主動進入地面戰的手段比較少。' }),
  makeNode('hybrid-ground-pound', '摔打連鎖', 'hybrid', 3, 'style', '抱摔只是第一步，取得上位後的重擊才是目的。', '抱摔成功後，上位打擊更有威脅，也更容易終結比賽。', ['wrestle-chain', 'ground-posture'], 'style-ground-pound', { tradeoff: '為了守住上位，會消耗大量力氣。' }),
  makeNode('hybrid-sub-hunter', '降服獵人', 'hybrid', 3, 'style', '在纏抱和混戰中不斷尋找裸露的頸部與手臂。', '轉換位置時，更容易抓到降服的機會。', ['clinch-trip', 'ground-arm'], 'style-submission', { tradeoff: '貿然出手失敗，很容易失去位置。' }),
]

const techniqueNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  branch: z.enum(['boxing', 'kicking', 'clinch', 'wrestling', 'ground', 'hybrid']),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  cost: z.number().int().min(1).max(3),
  prerequisites: z.array(z.string()),
  unlockKey: z.string().min(1),
})

export function validateContent(): void {
  z.array(techniqueNodeSchema).length(36).parse(TECHNIQUE_NODES)
  const ids = new Set(TECHNIQUE_NODES.map((node) => node.id))
  if (ids.size !== TECHNIQUE_NODES.length) throw new Error('科技節點 ID 重複')
  for (const node of TECHNIQUE_NODES) {
    for (const required of node.prerequisites) {
      if (!ids.has(required)) throw new Error(`節點 ${node.id} 缺少前置 ${required}`)
    }
  }
}

validateContent()
