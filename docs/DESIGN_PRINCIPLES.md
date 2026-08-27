# Design principles

## Player experiment

The player begins as an ordinary late-Ming youth and wants to discover what kind of martial life this imperfect person can build before age, injury, and accumulated obligations close the road.

Every run follows this loop:

> reveal meaningful state → present a consequential choice → resolve bounded uncertainty → persist the consequence → remember it in the biography → create the next question

## Whole-life structure

- A life spans sixteen turns across youth, entry, wandering, renown, and later life. Each phase changes the context and stakes, not only the numbers.
- Seeded identity reveals origin, a conditional trait, and a burden. Current ability is shown separately from potential; growth moves toward visible ceilings and potential never guarantees greatness.
- Origin, trait, and burden each use a seeded rarity roll: 普通 60%, 稀有 30%, 傳說 10%, followed by an even pick within the rolled tier. Rarity means how often an identity appears, not raw power; rare burdens may be harsher and common traits can remain useful. The reveal screen always discloses these odds.
- The six sects are distinct move kits and play styles. A sect provides direction, not a guaranteed ending.
- Each turn previews a concrete encounter objective, offers preparation through training, paid work, or helping, then resolves a deterministic battle and a remembered aftermath.

## Agency, uncertainty, and causality

- The same game version, seed, identity, difficulty, and choices must reproduce identity, scene order, battle seeds, and outcomes.
- Important choices change growth, money, reputation, relationships, combat preparation, future support, or the ending. Effects must be previewed before commitment.
- Randomness is bounded and explainable. The player chooses what to prepare for and the biography records consequential outcomes.
- Defeat changes the career through injury, adaptation, and learning; it does not erase the life. Imperfect lives remain valid stories.

## Biography and relationships

- Every battle result is both reward feedback and a biography record: grade, named moment, recovery or injury, rewards, and one chronicle line.
- Every life seeds one friend and one rival. Repeated help can bring the same friend into battle; paid work sharpens the same rivalry; milestone rematches and the ending reuse those people.
- Endings are short biographies built from turning points, defining relationships, injuries, unrealized possibilities, and reputation—not raw stat dumps.

## Progression and replay

- Three deterministic difficulty profiles alter the pressure without changing causality.
- Completed lives award locally stored 江湖見聞. Four points buy one modest 師門傳承 rank for future lives; account progress must remain less important than identity and choices.
- Seeds support replay, comparison, sharing, and debugging. Save compatibility is explicit through the run version; rarity selection begins at save version 5, so earlier in-progress runs restart while legacy progression remains.

## Ethical engagement

Replay should come from curiosity about another possible life, not artificial waiting, loss chasing, paid rerolls, misleading odds, or punishment for stopping.

## Current technical boundaries

- `app/life-engine.ts` owns life state and rules.
- `app/battle/` stays pure and deterministic.
- Browser storage is used only for the current local save and modest legacy progress.
- Combat advances automatically through non-player turns. Player input is reserved for target and move decisions.
