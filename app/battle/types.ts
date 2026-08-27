export type Role = 'player' | 'tank' | 'healer' | 'warrior' | 'assassin';
export type MoveSlot = 'attack' | 'ultimate' | 'recovery' | 'defense';

export type BattleSide = 'ally' | 'enemy';
export type BattleResult = 'victory' | 'defeat' | null;
export type BattleTarget = 'selected-enemy' | 'weakest-ally' | 'weakest-enemy' | 'first-enemy' | 'random-foe' | 'self' | 'taunt-target';
export type BattleTrigger = 'battle-start' | 'before-damage' | 'after-damage' | 'before-defeat' | 'action';
export type BattleCondition =
  | { type: 'health-below'; percent: number }
  | { type: 'target-health-below'; percent: number }
  | { type: 'has-qi'; amount: number }
  | { type: 'talent'; id: string }
  | { type: 'actor-id'; id: string };

export type BattleEffect =
  | { type: 'damage'; multiplier?: number; flat?: number; strengthScaling?: number }
  | { type: 'heal'; amount: number }
  | { type: 'restore-qi'; amount: number }
  | { type: 'guard'; amount: number; maxHpPercent?: number }
  | { type: 'taunt'; turns: number; cooldown: number }
  | { type: 'spend-money-guard'; maximumPercent: number; moneyPerTwoDamage: boolean }
  | { type: 'pain-to-qi'; ratio: number }
  | { type: 'prevent-defeat'; guardMaxHpPercent: number; readyProgress: number }
  | { type: 'intercept-lethal' }
  | { type: 'apply-status'; id: string; stacks?: number; target?: 'self' | 'target' }
  | { type: 'consume-status-damage'; id: string; damagePerStack: number; delayPerStack?: number; statusTarget?: 'self' | 'target' }
  | { type: 'counter'; damage: number; grantStatus?: { id: string; stacks?: number; target?: 'self' | 'source' } }
  | { type: 'reduce-next-hit'; percent: number }
  | { type: 'expose-next-hit'; percent: number };

export type BattleActionDefinition = {
  id: string;
  target: BattleTarget;
  qiCost?: number;
  conditions?: BattleCondition[];
  effects: BattleEffect[];
  priority?: number;
  label?: string;
};

export type BattlePassiveDefinition = {
  id: string;
  trigger: BattleTrigger;
  conditions?: BattleCondition[];
  oncePerBattle?: boolean;
  effects: BattleEffect[];
};

export type BattleActor = {
  id: string;
  name: string;
  role: Role;
  side: BattleSide;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  attack: number;
  defense: number;
  guard: number;
  progress: number;
  baseSpeed: number;
  speed: number;
  actionsTaken: number;
  tauntTurnsRemaining?: number;
  tauntCooldown?: number;
  actionIds?: string[];
  passiveIds?: string[];
  statuses?: Record<string, number>;
  counter?: { damage: number; grantStatus?: { id: string; stacks?: number; target?: 'self' | 'source' } } | null;
  nextHitMultiplier?: number;
};

export type BattleIntent = { actorId: string; actorName: string; icon: string; actionId: string; targetId: string | null };
export type BattleEvent =
  | { type: 'ready'; actorId: string; actorName: string; side: BattleSide }
  | { type: 'action'; actorId: string; actorName: string; side: BattleSide; actionId: string; targetId?: string; targetName?: string; damage?: number; heal?: number; guard?: number; interceptedBy?: string }
  | { type: 'status'; actorId: string; actorName: string; side: BattleSide; statusId: string; stacks: number; damage: number }
  | { type: 'result'; result: Exclude<BattleResult, null> };

export type BattleState = {
  seed: string;
  encounterId: string;
  title: string;
  cause: string;
  stakes: string;
  mandatory: boolean;
  turn: number;
  tick: number;
  rngIndex: number;
  readyActorId: string | null;
  selectedTargetId: string | null;
  actionSerial: number;
  tauntActorId: string | null;
  result: BattleResult;
  actors: BattleActor[];
  intents: BattleIntent[];
  events: BattleEvent[];
  consumedPassives: string[];
  resources: { money: number; phoneCharges: number; flags: string[]; talents: Record<string, number>; strength: number; partySize: number };
};

export type BattleRules = {
  actions: Record<string, BattleActionDefinition>;
  passives: Record<string, BattlePassiveDefinition>;
  speedModifiers: Array<{ passiveId: string; actor: 'player' | 'ally'; multiplier: number; condition?: BattleCondition }>;
  damageModifiers: Array<{ passiveId: string; actor: 'player' | 'ally'; multiplier: number; condition?: BattleCondition; perPartyMember?: number; perMoney?: number; maximumStacks?: number }>;
};

export type BattleSetup = Omit<BattleState, 'turn' | 'tick' | 'readyActorId' | 'selectedTargetId' | 'actionSerial' | 'tauntActorId' | 'result' | 'intents' | 'events' | 'consumedPassives'>;
export type BattleCommand = { type: 'advance' } | { type: 'select-target'; targetId: string } | { type: 'use-action'; actionId: string; targetId?: string };
export type BattleTransition = { state: BattleState; events: BattleEvent[]; result: BattleResult; resourceChanges: { money: number; flagsAdded: string[] }; rngIndex: number };
export type BattleMoveSelection = { slot: MoveSlot; actionId: string };
