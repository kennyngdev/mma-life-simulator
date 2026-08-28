# Cage Life — Canonical Game Design Specification

Status: accepted design baseline  
Last consolidated: 2026-08-28

## 1. Purpose and authority

This document consolidates the accepted design decisions from the project's design conversations and the behavior now present in the game. It is the canonical product-design reference for future gameplay, content, balance, and progression work.

Use these status meanings throughout the document:

- **Accepted**: preserve this behavior unless a later explicit decision replaces it.
- **Deprecated**: do not extend or restore it; compatibility code may remain temporarily.
- **Open**: a goal or problem is recognized, but no implementation has been approved.

When a new explicit product decision conflicts with this document, the new decision wins and this document must be updated in the same change.

## 2. Design thesis

`Cage Life` is a seeded, mobile-first MMA career life simulation. A run should answer:

> Can this particular fighter turn their body, background, aptitudes, learned techniques, relationships, and accumulated fight history into a meaningful career before injury, time, and stronger opposition close the window?

The player authors the fighter's identity, region, motive, starting experience, opponent choices, preparation, tactics, and responses to life events. The seed reveals aptitudes, background where applicable, body, traits, opponents, and uncertain outcomes. Neither seed nor starting tier should predetermine the only worthwhile life.

The intended repeated loop is:

```text
reveal a particular fighter
→ choose an opponent and the risk to accept
→ spend three camp slots preparing
→ resolve a life event and weight decision
→ choose a fight plan and position-specific actions
→ persist damage, relationships, evidence, moves, traits, and history
→ face the next career question or retire into a biography
```

The primary progression fantasy is not “numbers go up.” It is “this fighter learned these moves, became known for these patterns, and earned this history.”

## 3. Player-owned career structure

### 3.1 Starting experiences — Accepted

| Experience | Starting competence | Career entry | Target career length |
|---|---|---|---|
| Normie | All five skills at level 0; emergency moves only | Grassroots | 16–20 fights |
| Hobbyist | Seeded background; primary and secondary skills at level 1; 3 and 2 learned moves respectively | Amateur | 12–16 fights |
| Semi-pro | Primary level 3 with 8 moves; secondary level 2 with 5; every other branch level 1 with 2 moves | Regional | 10–13 fights |

All three experiences receive the same seeded body, aptitude, relationship, and 1–3 birth-trait systems. The Normie route is longer, not inherently better; the Semi-pro route trades early competence for less time to shape a legacy.

Normie opponents in the grassroots prologue should be low-skill, distinctive gym smokers and exhibitions. Keep this phase playful and aspirational; do not frame ordinary criminal assaults as the fighter's career ladder.

### 3.2 Stage thresholds — Accepted

| Experience | Grassroots | Amateur | Regional | Asia | World | Legacy |
|---|---:|---:|---:|---:|---:|---:|
| Normie | fights 0–2 | 3–5 | 6–8 | 9–12 | 13–15 | 16+ |
| Hobbyist | — | 0–2 | 3–5 | 6–9 | 10–12 | 13+ |
| Semi-pro | — | — | 0–2 | 3–6 | 7–9 | 10+ |

Stages must change opposition, stakes, money, reputation, and the interpretation of preparation. They must not be merely renamed number bands.

### 3.3 World-title credibility — Accepted

A world-title offer is earned through both results and credible competitive standing. It becomes available only after at least 10 fights and 8 wins, when the player is ranked in the top 20 and has a competitive rating of at least 70. The championship opponent must be ranked in the top 10 with a competitive rating of at least 70. A development opponent cannot be relabeled as a champion merely because the career has reached a fight-count threshold.

Ordinary matchmaking is led by career ranking rather than competitive rating alone. Each offer cycle should center its three choices around an opponent roughly 10 places below the player, a peer near the player's rank, and an opponent roughly 10 places above the player, subject to roster boundaries and rematch availability. Competitive-rating differences remain visible as risk; a fighter whose ranking has outpaced their ability should face a legibly dangerous slate rather than being silently matched far down the rankings.

Ranking movement must reflect the defeated opponent's standing. Beating a peer or lower-ranked opponent produces a modest two-place climb. Beating a higher-ranked opponent places the winner at or just behind that opponent: zero places behind for a gap below 10, one for 10–19, two for 20–29, and three for a gap of 30 or more. Thus a #59 fighter who defeats #9 becomes #12; the result cannot be compressed into a generic six-place gain.

## 4. Skills, training, and moves

### 4.1 Canonical skill model — Accepted

The five combat skills are boxing, kicking, clinch, wrestling, and ground. Each has cumulative XP, a derived level from 0–5, a seeded aptitude, and learned moves.

| Level | Player-facing strength | Cumulative XP | Combat rating |
|---:|---|---:|---:|
| 0 | 未受訓 | 0 | 10 |
| 1 | 初學 | 100 | 30 |
| 2 | 中階 | 300 | 50 |
| 3 | 熟練 | 600 | 68 |
| 4 | 進階 | 1,000 | 84 |
| 5 | 大師 | 1,500 | 96 |

Aptitude is visible, seeded independently per branch, and ranges from `0.8×` to `1.2×` XP gain. It affects learning speed but never creates a hard mastery cap.

Level is an access gate and concise summary. Learned moves and earned traits are the identity the player should actually feel.

### 4.2 Camp loop — Accepted

Each fight camp has three slots. The available activities are:

- **Technique training**: the player chooses a branch, performs its drill, gains XP, and then chooses two actual moves to learn from up to four seeded, level-eligible unlearned moves. If fewer than two moves remain, the player learns every remaining offered move.
- **Film study**: improves scouting accuracy and fight IQ at a small fatigue cost.
- **Recovery**: reduces fatigue and restores health; it does not create skill growth.

Technique XP is:

```text
round((70 + 30 × drill score) × aptitude × coach modifier × learning-trait modifier)
```

Coach modifiers are `0.9×` when strained, `1.0×` when steady, and `1.1×` when trusted. A fighter's first successful level-0 session receives enough additional XP to reach level 1. Repeating technique sessions in one camp increases fatigue.

The move offer has no reroll. Until learned, every branch's offer prioritizes a functional foundation: boxing receives complementary basic attacks, kicking receives distance management and a meaningful kick, clinch receives an entry and an attack, wrestling receives an actual takedown and setup, and ground receives both a foundational escape and a foundational submission. Level-ups are milestones; they do not limit the fighter to one learned move per level.

### 4.3 Move access — Accepted

- Every position must always provide weak universal emergency actions so an incomplete moveset cannot soft-lock a fight.
- All non-emergency combat moves must be learned through the fighter's background or technique training.
- A move has a branch, minimum level, legal positions, and combat properties.
- Identity-defining access levels are authored according to learning complexity and style function rather than inferred only from damage, control, or finish pressure. A Normie's first successful session in a branch must make that style usable in combat; later levels add stronger, more specialized, or more position-dependent techniques.
- Basic submissions, a real takedown, and a deliberate clinch entry are early foundations. Mastery levels may improve chains and finish pressure, but cannot be the fighter's first access to the branch's defining action.
- Combat presents only legal emergency moves and learned moves, with a defensive/transition fallback if required for safety.
- Training should broaden a branch with new tactical options or deepen it with stronger, more specialized options. A flat stat increase alone is not an adequate technique-training reward.

### 4.4 Retired progression — Deprecated

Talent points, the player-facing tech tree, node unlocking, and node mastery are replaced by skill XP, learned moves, and traits. Compatibility fields such as `technique`, `techniquePotential`, `insight`, `unlockedNodes`, and `mastery` still exist in parts of the current state model. They may be used as derived or migration data, but new progression features must not depend on them or expose the old tech-tree loop again.

`實戰對練` / practical sparring is retired. It was removed because its choices did not alter subsequent exchanges, its reading and timing demands conflicted, and its sharpness reward did not create enough unique strategic consequence. Do not restore it as a fourth camp activity without a new explicit decision and a prototype proving persistent, branch-sensitive consequences. The training-partner relationship remains valid biography state.

## 5. Traits and fight evidence

### 5.1 Birth traits — Accepted

Every fighter and generated opponent begins with 1–3 seeded traits:

- Trait count: 1 at 50%, 2 at 35%, 3 at 15%.
- Rarity: common 60%, uncommon 25%, rare 12%, legendary 3%.
- Nominal positive-effect ceilings: common 8%, uncommon 15%, rare 25%, legendary 35%.
- Mutually incompatible traits cannot appear together.

A trait must describe a recognizable fighter. It needs a condition, a gameplay effect, and normally a trade-off or limited activation window. Exact opponent traits and effects are visible on fight offers so the player can prepare rather than discover arbitrary hidden bonuses.

### 5.2 Performance-earned traits — Accepted

Only the player earns new traits during a career. There is no hard count cap and no duplicate trait IDs. Progress becomes visible after the first qualifying action, with the exact threshold shown. Awards occur after fight processing, enter history, and appear before the career continues.

| Trait | Evidence threshold | Effect |
|---|---|---|
| Power Puncher | 2 true punch KOs | +20% punch damage and punch finish pressure |
| High-Kick Artist | 2 true kick KOs | +20% kick damage and kick finish pressure |
| Submission Hunter | 2 submission wins | +20% submission finish pressure |
| Escape Artist | 3 clean bottom escapes | +15% bottom defensive and transition success |
| Comeback Fighter | Win 2 fights after losing round one | +20% success while behind after round one |
| Iron Will | Survive 3 finish windows | +20% defensive success while critically damaged |
| Cage General | Accumulate 6 minutes of cage control | +15% cage-control effects |

Punch and kick KO traits count only a recorded `KO`, not a TKO, and use the recorded finishing move's strike kind. Modifier families stack additively and are capped at `±50%`.

Trait activation must be causally legible in fight choices, narration, or results. A powerful bonus that the player cannot connect to the fighter's identity is a design failure.

## 6. Combat decisions and causality — Accepted

Combat is position-based. The player selects a round plan, learns why the opening position occurred, and then chooses legal learned or emergency moves under bounded uncertainty. Important actions can change damage, stamina, control, openings, position, finish pressure, later availability, and the opponent's response.

Preserve these constraints:

- Show why the current position or major result was plausible, including tactics, relevant skill, traits, damage, and opponent behavior.
- Make transition moves available in striking, clinch, wrestling, and ground contexts where they create meaningful routes rather than decorative variety.
- Preserve takedown routes for wrestling backgrounds and enough ground-and-pound, defense, escape, and stand-up options to avoid dead positions.
- Let injury and body-part damage meaningfully alter success and fight outcomes.
- Between rounds, default courtside advice to **rest**, providing moderate stamina recovery with no penalty. More aggressive or specialized adjustments remain deliberate choices.
- A submission, KO, or TKO resolution may take over the full viewport so the climax reads clearly and cannot be confused with an ordinary exchange.
- A player victory by submission, KO, or TKO receives a distinct post-fight celebration that identifies the method, round, and finishing move, followed by both color-commentary excitement and coach praise. Decision wins, draws, and losses retain a more restrained result treatment.

Randomness may surprise the player, but the player should be able to trace a major outcome partly to preparation, build, earlier choices, and visible fight state.

## 7. Relationships, events, and biography — Accepted

Coach, family, and training-partner relationships persist across the career. Track and surface them only where trust or shared history changes training, recovery, choices, callbacks, or the final biography.

- Coach trust modifies technique XP.
- Family trust modifies recovery.
- The training partner remains a relationship and biography character even though practical sparring is retired.
- Life events may trade money, fatigue, health, readiness, trust, and reputation, and should create a remembered consequence rather than isolated flavor text.

Failure should redirect, scar, constrain, or conclude a career meaningfully instead of invalidating the run. Retirement output must synthesize starting experience, final skill levels, signature moves, birth and earned traits, turning points, relationships, achievements, failures, and unrealized possibilities. Raw totals are secondary evidence, not the ending itself.

## 8. RNG, seeds, saves, and reproducibility — Accepted

The seed supports alternate-life comparison, sharing, and debugging. Randomness is split into named streams for identity, opponents, offers, events, fights, and cosmetics so presentation-only changes do not silently rewrite a career.

Given the same rules/content versions, seed, and player choices, aptitude, background, birth traits, move offers, opponents, and career outcomes should reproduce. Branching player choices may reroute later random consumption.

Rules, content, and save versions are part of the reproducibility contract. A breaking rules change may reset active careers with an explanation; archived biographies should be preserved whenever their stored data remains readable. Migrations must return a save stranded in a retired phase to a valid decision point and restore any consumed camp slot where appropriate.

## 9. Economy — Accepted

Money represents **career optionality**, not survival or permanent combat power. Early funds provide medical and logistical breathing room, mid-career savings provide control over contracts and timing, and late-career money can become generosity, security, or legacy.

- Starting funds, purses, sponsorships, and event rewards remain the main sources. Fight purses expose a stage base plus visible opponent-risk, short-notice, and title adjustments.
- The interface derives `資金吃緊`, `有緩衝`, or `可自主選擇` from current funds relative to a typical stage purse. This runway description is not stored and has no direct modifier.
- Once per offer cycle, a fighter may spend roughly 35% of a typical purse to replace the current offers without advancing a year. The ordinary offers and free decline-with-time route remain available.
- Paid medical or logistical support mitigates immediate risk. An unaffordable option is visibly unavailable and every event retains a viable non-monetary route through time, risk, or relationship obligation.
- At most one economy decision appears around a fight. A paid offer replacement consumes that fight's economy slot; otherwise contextual short-notice, first-away, medical, sponsorship, or legacy choices can replace the ordinary life event rather than adding another management screen.
- Late-career choices may invest approximately one typical purse in the home gym or preserve funds while contributing time or securing retirement. These choices affect relationships, reputation, history, and biography rather than combat ability.
- Base training, move learning, fight entry, and universal emergency actions never cost money. There is no debt, interest, mandatory upkeep, equipment tier, purchased XP, purchased move, or permanent rating purchase.
- Major financial choices enter history and can be synthesized in the retirement biography. Routine transactions remain totals rather than narrative events.

Regional multipliers apply consistently to local-stage income and stage-relative costs. Balance should keep zero-money careers fully completable, make spending understandable and tempting without creating an automatic option, and limit the competitive gap between low- and high-fund careers.

## 10. Interface principles — Accepted

`UI_PRINCIPLES.md` is the detailed authority for interface work. In particular, the game is mobile-first, Traditional Chinese is the primary player-facing language, the current decision must dominate the screen, and cause/effect must remain legible.

The status UI should show each branch's derived 0–100 combat ability alongside its player-facing strength label and XP. Status strength badges are `未受訓`, `初學`, `中階`, `熟練`, `進階`, and `大師` for levels 0–5 respectively; do not use raw `Lv.` notation for those fighter-strength badges. The screen should also emphasize aptitude, learned moves, traits, trait discovery progress, injuries, current objective, and recent changes. The ability value must come from the canonical skill-rating mapping rather than presenting a stale compatibility field. It must not revive the old tech-tree or present every stored compatibility field as meaningful player state.

## 11. Smallest complete-life standard

A feature set is not a successful life sim merely because combat works. A complete slice must support:

- at least two plausible futures from the opening reveal;
- changing stakes across career phases;
- deliberate opponent and camp choices;
- learned moves that change fight options;
- at least one relationship callback;
- recoverable and career-changing failure;
- visible progress toward an earned trait;
- multiple meaningful career outcomes;
- a retirement biography that refers to actual run history.

Prioritize strengthening this full-life loop over multiplying disconnected events, moves, meters, or minigames.

## 12. Verification and design acceptance

Gameplay changes should preserve or explicitly revise these tests:

- Same seed plus same choices reproduces the same generated career inputs and outcomes for the same versions.
- Each starting experience receives the correct entry stage, skill levels, moves, and career thresholds.
- A level-0 fighter always has a legal action in every reachable position.
- The first ground technique session can teach an escape and reaches level 1.
- A Normie's first technique session in every branch offers its functional foundation; the first ground session offers both an escape and a submission, and the first wrestling session offers a real takedown.
- A technique reward offers up to four moves, requires two selections when available, and learns both only after confirmation.
- XP thresholds, aptitude, relationship, and trait modifiers are correct and visible.
- Unlearned non-emergency moves never appear in combat.
- Trait evidence uses the correct finish method and move attribution, awards once, and persists to history and biography.
- All three starting experiences remain viable; the longest route is not automatically optimal.
- Retired practical-sparring state migrates back to a playable camp without losing a slot.
- The primary gameplay path remains usable at a 320 px viewport without horizontal scrolling or hidden essential actions.

Balance simulations and automated tests are evidence, not substitutes for playtesting. A new activity must also prove that its choices change later state, that players can understand the consequence, and that it creates a next question worth caring about.

## 13. Consolidated decision record

This is a decision summary, not a transcript. Superseded implementation discussion is intentionally omitted.

| Date | Status | Decision and rationale |
|---|---|---|
| 2026-08-28 | Accepted | Replace talent points and the tech tree with five level 0–5 XP skills. Progress should produce learned moves and a recognizable fighting identity. |
| 2026-08-28 | Accepted | Technique training always culminates in a real move choice; levels gate the pool but do not ration one move per level. |
| 2026-08-28 | Accepted | Offer Normie, Hobbyist, and Semi-pro starts with different competence, entry stages, and career lengths so the opening changes the life question. |
| 2026-08-28 | Accepted | Use seeded birth traits plus performance-earned traits with visible evidence thresholds; traits replace passive tree-node identity. |
| 2026-08-28 | Deprecated | Remove `實戰對練`; playtesting showed scripted follow-up exchanges, conflicting reading/timing demands, and an insufficiently consequential reward. |
| 2026-08-28 | Accepted | Make combat causality explicit through position-entry explanations, legal learned moves, transition routes, injury effects, and clear climax presentation. |
| 2026-08-28 | Accepted | Treat money as career optionality: risk-priced purses, derived runway labels, one paid offer replacement per cycle, affordable/free medical and logistics alternatives, and late-career legacy spending. Money cannot gate the core loop or buy permanent combat power. |
| 2026-08-28 | Accepted | Technique training now teaches two of up to four offered moves. Each branch guarantees an early functional foundation, while authored move levels make basic submissions, takedowns, and clinch entries available before mastery. This prevents a Normie from repeatedly investing in a style without gaining its defining combat route. |
