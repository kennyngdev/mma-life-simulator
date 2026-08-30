# 拳途人生 Cage Life — Canonical Game Design Specification

Status: accepted design baseline  
Last consolidated: 2026-08-29

## 1. Purpose and authority

This document consolidates the accepted design decisions from the project's design conversations and the behavior now present in the game. It is the canonical product-design reference for future gameplay, content, balance, and progression work.

Use these status meanings throughout the document:

- **Accepted**: preserve this behavior unless a later explicit decision replaces it.
- **Deprecated**: do not extend or restore it; compatibility code may remain temporarily.
- **Open**: a goal or problem is recognized, but no implementation has been approved.

When a new explicit product decision conflicts with this document, the new decision wins and this document must be updated in the same change.

### 1.1 Production publishing — Accepted

`playcagelife.com` is the sole production distribution site. The game is built and published through GitHub Pages from this repository's `master` branch; the GitHub Pages workflow is the only production deployment path. Do not create, deploy, or maintain a separate ChatGPT Sites-hosted version of the game.

### 1.2 PWA entry prompt — Accepted

Character creation must display a compact Traditional-Chinese prompt whenever the game is opened in an ordinary browser tab rather than PWA standalone mode. The prompt explains that adding the game to the device home screen provides an app-like launch experience and that progress remains on the device. When the browser exposes an install prompt, provide a direct install action; otherwise give browser-agnostic “install app / add to home screen” guidance. Do not show this prompt in standalone mode.

## 2. Design thesis

`拳途人生 Cage Life` is a seeded, mobile-first MMA career life simulation. A run should answer:

> Can this particular fighter turn their body, background, aptitudes, learned techniques, relationships, and accumulated fight history into a meaningful career before injury, time, and stronger opposition close the window?

The player authors the fighter's identity, region, motive, starting experience, opponent choices, preparation, tactics, and responses to life events. The seed reveals aptitudes, background where applicable, body, traits, opponents, and uncertain outcomes. Neither seed nor starting tier should predetermine the only worthwhile life.

The intended repeated loop is:

```text
reveal a particular fighter
→ choose an opponent and the risk to accept
→ spend three camp slots preparing
→ resolve a life event
→ choose a fight plan and either position-specific actions or coach-guided exchanges
→ persist damage, relationships, evidence, moves, traits, and history
→ face the next career question or retire into a biography
```

The primary progression fantasy is not “numbers go up.” It is “this fighter learned these moves, became known for these patterns, and earned this history.”

## 3. Player-owned career structure

### 3.1 Starting experiences — Accepted

| Experience | Starting competence | Career entry |
|---|---|---|
| Normie | All five skills at level 0; weak branch-specific survival actions only | Grassroots |
| Hobbyist | Seeded background; primary and secondary skills at level 1; each trained branch includes its three-move foundation | Amateur |
| Semi-pro | Primary level 3 with 8+ moves; secondary level 2 with 5+; every other branch level 1 with its three-move foundation | Regional |

All three experiences receive the same seeded body, aptitude, relationship, and 1–3 birth-trait systems. The Normie route begins earlier and provides more development runway before the same age and injury pressures; the Semi-pro route begins with greater competence at a later career stage. Starting experience never assigns a seeded fight-count limit.

Normie opponents in the grassroots prologue should be low-skill, distinctive gym smokers and exhibitions. Keep this phase playful and aspirational; do not frame ordinary criminal assaults as the fighter's career ladder.

### 3.2 League structure and progression — Accepted

Grassroots is an unranked Normie prologue. Competitive play then uses four independent top-15 leagues in this order: **Amateur → Regional → Asia → World**. Each league has exactly one unranked champion above numbered ranks #1–#15. Legacy is the post-World-title career phase, not a fifth league.

The player enters a league as `未排名`, receives opponents around #13–#15, and earns a numbered place through player-involved results. Every league stores its own fights, wins, losses, draws, consecutive wins, best rank, titles, and defenses. A champion has no numeric rank and must never be rendered as #0 or another numbered slot.

Starting placement is deliberately legible: Normie completes three Grassroots fights before entering Amateur unranked; Hobbyist starts Amateur unranked; Semi-pro starts Regional unranked. Moving up is irreversible. After winning an Amateur, Regional, or Asia title, the player chooses between joining the next league unranked (vacating the old belt) or staying to defend. A successful defense presents the same choice again. Winning the World title keeps the player World champion and enters Legacy; there is no higher league.

Only player-involved fights change standings in v1. League rosters are seeded once and persist, so every rise, fall, rematch, and title change has an understandable cause.

### 3.3 Career endings — Accepted

Fight count never forces retirement. The retired seed-generated career-length target is not part of fighter state, matchmaking, progression, or ending logic, and older saves must discard it without ending the active career.

A career ends automatically only when:

- the fighter reaches age 38; or
- after a fight, any long-term health value—head, hands, knees, or torso—is 10 or below.

The player may also choose retirement from the offer screen after five fights or from age 34. Winning or losing a particular fight, including a world-title fight, does not itself end the career unless the fight also crosses an age or health boundary.

After a fight, a long-term health value from 11 through 25 blocks the next fight and presents an explicit choice: take a one-year medical layoff or retire immediately. Choosing the layoff restores 18 health to the weakest affected part, lowers fatigue, and costs the year and that offer cycle; if the layoff reaches age 38, age retirement still applies. The interface must state both the 25-point layoff line and 10-point retirement line, show the fighter's current weakest long-term health value in ordinary career context, warn when a value approaches either line, and name injury as the cause when it ends the career. A retirement trigger must never arrive as an unexplained seeded timer.

### 3.4 League rankings, matchmaking, and titles — Accepted

Within a top-15 ladder, an unranked winner takes the defeated ranked opponent's slot. Beating a higher-ranked opponent places the player at or immediately behind that opponent; a gap of 10 or more places leaves the player one slot behind. Beating a peer or lower-ranked opponent climbs two places. Ordinary losses drop three places and draws drop one; falling below #15 makes the player unranked. Affected opponents shift so the champion and every numbered slot remain unique.

Unranked offers target roughly #13–#15, plus an optional **快速晉級卡** challenge around #10. Ranked offers target roughly three places below, a peer, and three places above, plus an optional fast-track opponent roughly six places above when that opponent is not already a normal offer. When a player's competitive rating materially differs from their standing, ordinary cards recenter on the closest opponent with comparable overall rating and lead capability (each fighter's strongest branch); component compatibility has equal selection weight to rank distance, while standings still determine ladder movement and the card's below/peer/above shape. A prior meeting carries a strong ordinary-card penalty, so a close matchup does not crowd out career variety. The fast-track card clearly explains that it is a harder ranking leap; a win uses the ordinary higher-ranked-opponent placement rule rather than a hidden bonus. A championship offer requires both current-league conditions: player ranked #1–#3 and competitive rating of at least 35 / 50 / 70 / 80 for Amateur / Regional / Asia / World. A challenge always names the league champion, who never displays a numeric rank. Other offers remain ordinary ranked fights.

Competitive rating is a rounded 0–100 summary of MMA readiness, calculated as:

```text
40% strongest skill + 20% second-strongest skill
+ 20% average of the other three skills + 20% fight IQ
```

The strongest two disciplines define a fighter's specialty and the lead discipline carries enough weight to surface a focused fighter's real exchange threat. The other three still contribute alongside fight IQ, so a young one- or two-discipline specialist must not display an elite overall rating while remaining untrained across most of MMA.

A failed title challenge leaves the player's rank unchanged and resets form; a draw leaves both champion and ranking unchanged. Winning a title removes the player from the numbered table and inserts the former champion at #1. A defense win records a defense; a defense draw retains the belt without reopening the promotion choice; a defense loss makes the challenger champion and places the former champion at #1. Championship results explicitly describe becoming, retaining, or losing the belt and never report a move to #0.

### 3.5 Weight-cut strategy — Deprecated

Weight-cut planning is not part of the player loop. A fighter's displayed division is a stable presentation derived from natural body weight and has no readiness, fatigue, health, or competitive modifier. Do not restore a pre-fight dehydration choice unless a future explicit decision establishes a strategically central, evidence-backed replacement.

Older saves on the removed weight screen must migrate directly to the pre-fight briefing without losing career progress.

### 3.6 Seeded body matchup — Accepted

Natural weight, height, reach, and frame are persistent seeded body traits. They create small matchup edges: height and reach favor range, while a thicker or heavier frame favors pressure, takedowns, and clinch control. These edges affect tactical exchanges and round-plan entry only; they do not modify competitive rating, finish opportunity, scouting, purse, ranking, readiness, fatigue, or health directly. The displayed division remains a presentation label derived from natural weight and is still non-mechanical.

The opponent roster stores its own deterministic body records. Opponent natural weight is hidden, while the pre-fight briefing shows visible measurements and the coach translates the matchup into a subtle tactical recommendation alongside overall rating, skill, readiness, and scouting risk.

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

Aptitude is visible, seeded independently per branch, and ranges from `0.8×` to `1.2×` XP gain. It affects learning speed but never creates a hard mastery cap. `大師` remains the level-five, 96-rating ceiling, but XP continues afterward: every further 175 XP can unlock one still-unlearned move from that branch.

Level is an access gate and concise summary. Learned moves and earned traits are the identity the player should actually feel.

### 4.2 Camp loop — Accepted

Each fight camp has three slots. The available activities are:

- **Technique training**: the player chooses a branch and receives a solid standard result immediately. Reaching the first 100-XP milestone grants that branch's complete level-one toolkit—one attack, one defense, and one transition. Each later 175-XP milestone offers one move from up to four eligible choices. A session that does not cross a move milestone refines the fighter's existing technique without granting a move.
- **Film study**: immediately improves scouting accuracy and fight IQ at a small fatigue cost.
- **Recovery**: immediately reduces fatigue and restores health; it does not create skill growth.

Every activity has a normal, auto-resolved result with a camp score of `0.70`. Repeating a familiar activity must not require a drill or a confirmation screen. The player may instead choose **Push for an edge**, which opens the action-specific minigame. Its raw performance is converted to a final score of:

```text
0.70 + 0.30 × raw drill score
```

The challenge can add XP, scouting, or recovery above the normal result, but cannot reduce the standard result. Its outcome should flow directly to the next meaningful decision (for example, move selection or the next camp slot), with a compact causal recap rather than a separate acknowledgement screen.

Technique XP is:

```text
round((50 + 20 × drill score) × aptitude × coach modifier × learning-trait modifier × camp factor)
```

The camp factor is `1.0×` for the first technique session in a branch, `0.85×` for the second, and `0.70×` for the third. Changing branch starts at `1.0×`; the reduced multiplier and added fatigue apply only when repeating the same branch. Coach modifiers are `0.9×` when strained, `1.0×` when steady, and `1.1×` when trusted. There is no first-session XP override: aptitude, coaching, traits, score, and camp order all affect how quickly a level-0 fighter reaches the first 100-XP foundation milestone. Focused camps remain useful, while the 175-XP move spacing and the level-five combat-rating ceiling prevent late XP from turning into unlimited rating growth.

The first 100-XP foundation is automatic rather than a choice: boxing receives `刺拳接直拳` / `迎擊勾拳切角` / `雙刺拳進場`; kicking receives `低掃` / `前踢` / `換架切外側`; clinch receives `貼身短膝` / `籠邊頭位控制` / `進入纏抱`; wrestling receives `領帶拍頭肩撞` / `下壓防摔繞側` / `抱摔切入`; and ground receives `防守架內短拳` / `打破上位姿勢` / `蝦形調髖`. These are respectively attack, defense, and transition actions. The move offer after that has no reroll. Each later move requires another 175 XP. Aptitude affects the timing of move growth without creating a hard cap.

### 4.3 Move access — Accepted

- Every position must always provide weak universal emergency actions so an incomplete moveset cannot soft-lock a fight.
- All non-emergency combat moves must be learned through the fighter's background or technique training.
- A move has a branch, minimum level, legal positions, and combat properties.
- Identity-defining access levels are authored according to learning complexity and style function rather than inferred only from damage, control, or finish pressure. A Normie's first 100 XP in a branch grants exactly one level-one attack, defense, and transition, making that style usable in combat; later levels add stronger, more specialized, or more position-dependent techniques. Before that foundation, a Normie has only weak branch-specific survival actions: boxing has `試探距離` / `切角脫離`; kicking has `試探低踢` / `長架防守`; clinch has `撐開空間` / `雙內勾撐開脫籠`; wrestling has `穩住重心` / `防守過勾反摔`; ground has `封閉防守架護身` / `貼籠起身`. These are learned opening actions, not a hidden universal moveset; position-specific emergency fallbacks exist solely to prevent a combat soft-lock.
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

`戰鬥天才` is legendary and growth-only: all five technique branches gain 12% more XP from training and each film-study session gains one additional Fight IQ. It grants no direct exchange, damage, stamina, or rating bonus, preserving the slower career curve.

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
| Chain Wrestler | 6 clean takedowns | +15% transition success |
| Knockdown Instinct | 3 knockdowns | +12% committed-move finish pressure |
| Finishing Rhythm | 4 finish wins | +10% committed-move finish pressure |
| Decision Craft | 5 decisions | +10% round recovery |
| Winning Routine | 8 wins | -8% action stamina cost |
| Deep-Water Survivor | Survive 6 finish windows | +10% defensive success while critically damaged |

Punch and kick KO traits count only a recorded `KO`, not a TKO, and use the recorded finishing move's strike kind. Modifier families stack additively and are capped at `±50%`.

A recorded knockdown is announced immediately in the fight, appears in that fight's result summary with its current-career total, and is distinct from a KO or TKO result. This keeps the `Knockdown Instinct` threshold causally legible.

Trait activation must be causally legible in fight choices, narration, or results. A powerful bonus that the player cannot connect to the fighter's identity is a design failure.

## 6. Combat decisions and causality — Accepted

Combat is position-based. The player selects a round plan, learns why the opening position occurred, and then chooses legal learned or emergency moves under bounded uncertainty. Important actions can change damage, stamina, control, openings, position, finish pressure, later availability, and the opponent's response.

### 6.1 Combat control modes — Accepted

Character creation offers two permanent per-career combat controls. **戰術操作** preserves position-specific move choice. **教練帶領** keeps opponent selection, camp choices, round plans, and between-round corner adjustments under player control, while the coach selects the highest-ranked legal learned or emergency move for each exchange using the same contextual combat scoring as the manual option list. It is not a separate combat ruleset: learned moves, injuries, stamina, traits, scouting, openings, adaptation, positions, and outcome formulas remain identical.

Coach-guided exchanges appear as a readable, chronological live feed that advances automatically rather than requesting empty confirmation taps. Position-entry causality remains visible in that feed. Both player finish opportunities and opponent finish threats still interrupt for the existing playable TKO/submission minigames. Existing careers migrate to **戰術操作** so no active player loses direct control.

The ground-position chain intentionally omits side control. Guard passes progress from defensive-guard top directly to mount, and failed bottom submissions may concede mount defense. Do not restore side-control positions or side-control-only attacks, submissions, transitions, escapes, visuals, or progression rewards without a new explicit decision.

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
- The reachable ground chain is guard, mount, and back control; side control and its dedicated moves are absent.
- A Normie's first 100 XP in every branch automatically grants its functional three-move foundation; the first ground foundation includes an escape route and the first wrestling foundation includes a real takedown.
- The first 100-XP milestone grants its fixed toolkit without a selection. Each later 175-XP milestone offers up to four moves and requires one selection before the move is learned. Sessions that do not cross a milestone grant no move.
- XP thresholds, aptitude, relationship, and trait modifiers are correct and visible.
- Unlearned non-emergency moves never appear in combat.
- Trait evidence uses the correct finish method and move attribution, awards once, and persists to history and biography.
- All three starting experiences remain viable; the longest route is not automatically optimal.
- Every league has one champion with no numeric rank and a unique #1–#15 table; identical seeds produce identical league rosters and preserve the intended rating curves.
- Normie Grassroots entry, unranked placement, rank shifts, displacement below #15, losses, draws, rematches, and per-league title-form resets remain causal and player-driven.
- Championship requirements are enforced at their exact boundaries (top three and rating floors 35 / 50 / 70 / 80); optional fast-track cards target a materially higher-ranked opponent and use ordinary causal rank placement; challenge, defense, belt turnover, promotion, and World-to-Legacy behavior are distinct.
- Competitive rating preserves specialization while counting all five skills; two advanced branches with three untrained branches cannot produce an elite overall rating.
- Offer, standings, promotion, accessible-label, and 320 px UI surfaces expose league standing without rendering a champion as a number.
- Legacy active careers migrate to World, old global ranks map with `ceil(oldRank × 15 / 99)`, current records and title history are preserved where possible, and unsigned offers are rebuilt deterministically.
- Seeded height, reach, natural weight, and frame persist for each opponent; range, pressure, takedown, and clinch outcomes receive only the documented small body-matchup edges, while displayed division remains non-mechanical.
- Existing `0.12.0 / 1.5.0`, `0.12.1 / 1.5.1`, `0.13.0 / 1.6.0`, `0.14.0 / 1.6.0`, `0.15.0 / 1.6.0`, `0.16.0 / 1.6.0`, `0.17.0 / 1.6.0`, `0.18.0 / 1.6.0`, `0.19.0 / 1.6.0`, `0.20.0 / 1.6.0`, `0.21.0 / 1.6.0`, `0.22.0 / 1.6.0`, `0.23.0 / 1.6.0`, and `0.24.0 / 1.6.0` saves deterministically backfill league standings, opponent body records, breadth-sensitive ratings, revised training and move-learning pace, fast-track cards, title eligibility, the injury-recovery window, and manual combat control, then load as `0.25.0 / 1.6.0` without losing an active fight or career. Unsigned offer sets can be refreshed; a signed fight is never rewritten.
- Fight count never triggers retirement, while age 38 and post-fight health at 10 or below do; 11–25 requires choosing the documented medical layoff or immediate voluntary retirement before the career can continue.
- Offer, status, injury-layoff, and injury-retirement surfaces state the health rule and current relevant condition.
- Retired practical-sparring state migrates back to a playable camp without losing a slot.
- The primary gameplay path remains usable at a 320 px viewport without horizontal scrolling or hidden essential actions.

Balance simulations and automated tests are evidence, not substitutes for playtesting. A new activity must also prove that its choices change later state, that players can understand the consequence, and that it creates a next question worth caring about.

## 13. Consolidated decision record

This is a decision summary, not a transcript. Superseded implementation discussion is intentionally omitted.

| Date | Status | Decision and rationale |
|---|---|---|
| 2026-08-28 | Accepted | Replace talent points and the tech tree with five level 0–5 XP skills. Progress should produce learned moves and a recognizable fighting identity. |
| 2026-08-28 | Accepted | Technique training always culminates in a real move choice; levels gate the pool but do not ration one move per level. |
| 2026-08-28 | Accepted | Offer Normie, Hobbyist, and Semi-pro starts with different competence and entry stages so the opening changes the life question. |
| 2026-08-28 | Accepted | Use seeded birth traits plus performance-earned traits with visible evidence thresholds; traits replace passive tree-node identity. |
| 2026-08-28 | Deprecated | Remove `實戰對練`; playtesting showed scripted follow-up exchanges, conflicting reading/timing demands, and an insufficiently consequential reward. |
| 2026-08-28 | Accepted | Make combat causality explicit through position-entry explanations, legal learned moves, transition routes, injury effects, and clear climax presentation. |
| 2026-08-28 | Accepted | Treat money as career optionality: risk-priced purses, derived runway labels, one paid offer replacement per cycle, affordable/free medical and logistics alternatives, and late-career legacy spending. Money cannot gate the core loop or buy permanent combat power. |
| 2026-08-28 | Accepted | Technique training supplies real tactical moves rather than a stat-only reward. Each branch guarantees an early functional foundation, while authored move levels make basic submissions, takedowns, and clinch entries available before mastery. |
| 2026-08-29 | Accepted | Remove the hidden seeded fight-count retirement limit. Careers now end only by voluntary retirement, age 38, or a visible post-fight long-term health threshold of 10 or below. At health 11–25, the UI blocks the next fight and lets the player choose a one-year medical layoff that restores the weakest part by 18 or immediate retirement; it must explain both thresholds and the cost. |
| 2026-08-29 | Accepted | Remove side control and its dedicated move family. Ground progression now goes directly from guard passing to mount, keeping fewer positions with clearer strategic roles. |
| 2026-08-29 | Accepted | Use GitHub Pages at `playcagelife.com` as the sole production distribution site. Do not deploy or maintain a ChatGPT Sites version. |
| 2026-08-29 | Accepted | At character creation, prompt browser-tab players in Traditional Chinese to install or add the PWA to their home screen; do not show the prompt in standalone PWA mode. |
| 2026-08-29 | Accepted | Replace the global #1–#99 ladder and fight-count progression with independent Amateur, Regional, Asia, and World top-15 leagues. Each league has one unranked champion; title challenges require top-three standing and rating floors 35 / 50 / 70 / 80. The two-consecutive-wins gate is removed. Every league also offers a clearly labeled, harder fast-track fight card against a substantially higher-ranked opponent when available; winning it uses ordinary causal rank placement. After a non-World title, the player chooses irreversible promotion or continued defenses; World gold enters Legacy. |
| 2026-08-29 | Accepted | Rebalance competitive rating to weight the strongest skill at 40%, second skill at 20%, the other three skills' average at 20%, and fight IQ at 20%. This keeps a focused specialty visible while stopping one high branch from overstating full-MMA readiness and skipping the intended league challenge. |
| 2026-08-29 | Accepted | Slow technique training to a 50–70 XP pre-modifier range with 100% / 60% / 28% first-to-third technique-session efficiency in each camp. The first session still makes a Normie functional, while concentrated training no longer trivializes later fights. |
| 2026-08-29 | Accepted | Tie move acquisition directly to skill growth: the first 100 XP automatically grants a three-move level-one attack/defense/transition foundation, while every later 175-XP milestone unlocks one selected move. Every session, including the first, follows aptitude-sensitive XP so low-talent fighters take longer to unlock moves. |
| 2026-08-29 | Accepted | A Normie begins with exactly two weak learned actions per branch—attack plus defense in boxing/kicking, defense plus escape in clinch/wrestling/ground—rather than a hidden universal toolkit. Hobbyists begin with their two trained branches' foundations; Semi-pros begin with a foundation in all five branches. |
| 2026-08-29 | Accepted | Expand performance-earned traits using recorded fight evidence, so more careers gain distinct milestones without random post-fight loot. Add the legendary growth-only birth trait `戰鬥天才`: +12% technical XP in every branch and +1 Fight IQ from film study, with no direct combat bonus. |
| 2026-08-29 | Accepted | Keep XP and 175-XP move milestones active after a branch reaches `大師`, while holding the level-five combat rating at 96. Ease same-branch camp repetition to 100% / 85% / 70% and do not penalize changing branches; this lets late-career fighters complete their authored move pool without reopening runaway rating growth. |
| 2026-08-30 | Accepted | Offer permanent per-career **戰術操作** and **教練帶領** controls at character creation. Coach-guided combat retains player round plans and corner choices, uses the same legal-move and combat scoring model to choose exchanges automatically, presents those exchanges as a readable live feed, and preserves playable TKO/submission windows for both attack and defense. |
