# 拳途人生 Cage Life — Canonical Game Design Specification

Status: accepted design baseline  
Last consolidated: 2026-08-31

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

### 1.3 Language support — Accepted

Traditional Chinese and global MMA English are complete presentation locales. An explicit `lang` URL choice takes priority, followed by the independently saved language preference and then browser-language detection; Chinese browsers begin in Traditional Chinese, known non-Chinese browsers begin in English, and unavailable language detection falls back to Traditional Chinese. Language is never part of career or combat state and must not alter seeded results. Players may switch immediately from the start screen or in-game settings. Generated regional identities use an authored Latin name alongside their native name where available, and a custom fighter may provide an optional English or romanized display name. Existing prose-only saves use exact localized history where semantic data survives and a faithful generic reconstruction where it does not.

## 2. Design thesis

`拳途人生 Cage Life` is a seeded, mobile-first MMA career life simulation. A run should answer:

> Can this particular fighter turn their body, background, aptitudes, learned techniques, relationships, and accumulated fight history into a meaningful career before injury, time, and stronger opposition close the window?

The player authors the fighter's identity, region, motive, starting experience, opponent choices, preparation, tactics, and responses to life events. The seed reveals aptitudes, background where applicable, body, traits, opponents, and uncertain outcomes. Neither seed nor starting tier should predetermine the only worthwhile life.

The intended repeated loop is:

```text
reveal a particular fighter
→ choose an opponent and the risk to accept
→ spend three camp slots preparing
→ resolve at most one contextually justified life event, or proceed directly
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

Only player-involved fights change standings. Offscreen bouts may change opponent records but never rank order. League rosters persist across the career; retirement replaces an opponent in the same champion or numbered slot, so every player rise, fall, rematch, and title change remains understandable.

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
45% strongest skill + 20% second-strongest skill
+ 20% Fight IQ + 15% average defensive coverage
```

Defensive coverage is calculated independently for each branch as 40% of branch ability, plus 30 points for a learned non-emergency defense and 30 for a learned non-emergency transition. Defense and transition credit require that branch to be level one. The five-branch coverage average gives an elite specialist a viable path when they develop real defensive literacy, while a pure one-branch build cannot qualify as a complete champion. Title floors remain 35 / 50 / 70 / 80 for Amateur / Regional / Asia / World. Runtime matchmaking, eligibility, and opponent comparisons use this central computation; a legacy stored opponent `rating` is compatibility data only.

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

Aptitude is visible, seeded independently per branch, and ranges from `0.8×` to `1.2×` XP gain. It affects learning speed but never creates a hard mastery cap. `大師` remains the level-five, 96-rating ceiling, but XP continues afterward: every further 150 XP can unlock one still-unlearned move from that branch.

Level is an access gate and concise summary. Learned moves and earned traits are the identity the player should actually feel.

### 4.2 Camp loop — Accepted

Each fight camp has three slots. The available activities are:

- **Technique training**: the player chooses a branch and a relevant learned-move focus, and receives a solid standard result immediately. The branch panel preselects a focus but permits another relevant learned move; returning from a challenge preserves the selected branch. Reaching the first 100-XP milestone grants that branch's complete level-one toolkit—one attack, one defense, and one transition. Each later 150-XP milestone offers one move from up to four eligible choices. If the session does not cross a move milestone, the focused move is prepared for the signed fight: its first use receives +6 success, visibly identifies the preparation, never stacks with itself, and expires after that fight.
- **Film study**: immediately improves scouting accuracy and fight IQ at a small fatigue cost. Training-partner trust modifies it at 0.9× / 1.0× / 1.1× for strained / steady / trusted.
- **Recovery**: immediately reduces fatigue and restores health; it does not create skill growth.

Every activity has a normal, auto-resolved result with a camp score of `0.70`. Repeating a familiar activity must not require a drill or a confirmation screen. The player may instead choose **Push for an edge** once per camp, which opens the action-specific minigame. Every challenge first shows the objective, controls, guaranteed standard reward floor, possible bonus, accessibility mode, and an explicit Start action; no timer begins before Start. Keyboard and pointer input are both supported, and reduced-motion or relaxed modes retain the full reward ceiling. Its raw performance is converted to a final score of:

```text
0.70 + 0.30 × raw drill score
```

The challenge can add XP, scouting, or recovery above the normal result, but cannot reduce the standard result. Its outcome should flow directly to the next meaningful decision (for example, move selection or the next camp slot), with a compact causal recap rather than a separate acknowledgement screen.

After a loss, the largest negative exchange-ledger factor becomes one concise rebuild lesson. The next camp surfaces that lesson and prioritizes a relevant counter among move-focus choices. A preparation credit earned from another career decision may prepare a learned move even when that session crosses a move milestone; ordinary training never stacks multiple +6 credits on one move.

Technique XP is:

```text
round((50 + 20 × drill score) × aptitude × coach modifier × learning-trait modifier × camp factor)
```

The camp factor is `1.0×` for the first technique session in a branch, `0.85×` for the second, and `0.70×` for the third. Changing branch starts at `1.0×`; the reduced multiplier and added fatigue apply only when repeating the same branch. Coach modifiers are `0.9×` when strained, `1.0×` when steady, and `1.1×` when trusted. There is no first-session XP override: aptitude, coaching, traits, score, and camp order all affect how quickly a level-0 fighter reaches the first 100-XP foundation milestone. Focused camps remain useful, while the 150-XP move spacing and the level-five combat-rating ceiling prevent late XP from turning into unlimited rating growth.

The first 100-XP foundation is automatic rather than a choice: boxing receives `刺拳接直拳` / `迎擊勾拳切角` / `雙刺拳進場`; kicking receives `低掃` / `前踢` / `換架切外側`; clinch receives `貼身短膝` / `籠邊頭位控制` / `進入纏抱`; wrestling receives `領帶拍頭肩撞` / `下壓防摔繞側` / `抱摔切入`; and ground receives `防守架內短拳` / `打破上位姿勢` / `蝦形調髖`. These are respectively attack, defense, and transition actions. The move offer after that has no reroll. Each later move requires another 150 XP. Aptitude affects the timing of move growth without creating a hard cap.

### 4.3 Move access — Accepted

- Each of the 19 positions exposes at least two authored, explicitly marked emergency survival actions so an incomplete moveset cannot soft-lock a fight. Emergency actions are deliberately weak and never appear as learned moves, training drills, move rewards, fight evidence, signature moves, or biography material.
- All non-emergency combat moves must be learned through the fighter's background or technique training.
- A move has a branch, minimum level, legal positions, and combat properties.
- Identity-defining access levels are authored according to learning complexity and style function rather than inferred only from damage, control, or finish pressure. A Normie's first 100 XP in a branch grants exactly one level-one attack, defense, and transition, making that style usable in combat; later levels add stronger, more specialized, or more position-dependent techniques. Before that foundation, an untrained Normie relies only on the position's authored emergency survival actions rather than a hidden learned toolkit.
- Every seeded background guarantees one mechanically truthful identity move: Boxing `jab-cross`, Sanda `catch-kick-sweep`, Muay Thai `clinch-short-knee`, Wrestling `shot-entry`, Judo `clinch-throw`, and BJJ `guard-kimura`.
- Basic submissions, a real takedown, and a deliberate clinch entry are early foundations. Mastery levels may improve chains and finish pressure, but cannot be the fighter's first access to the branch's defining action.
- Combat presents only legal authored emergency moves and learned ordinary moves. No unlearned ordinary move may be introduced as a fallback.
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

Only the player earns new traits during a career. There is no hard count cap and no duplicate trait IDs. Progress becomes visible after the first qualifying action, with the exact threshold shown. Awards occur after fight processing, enter history, and appear before the career continues. A growth screen appears only for a new trait, newly advanced trait progress, or a mandatory injury/retirement consequence; an empty acknowledgement always flows directly to the next required career screen.

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

### 5.3 Contextual trait execution — Accepted

Every displayed trait condition, benefit, limit, and trade-off is an executable contextual rule rather than a broad modifier-family approximation. The same evaluator applies symmetrically to player and opponent. Once-per-round activations are tracked independently for each side, and trait contributions enter the same exchange-factor ledger used by odds and explanation.

`submission-sense` retains its authored upside, but a failed or countered submission attempt costs an additional 25% of its base stamina cost, with a minimum additional cost of two. Narration and result explanation may claim a trait contribution only when its condition actually activated.

## 6. Combat decisions and causality — Accepted

Combat is position-based. The player selects a round plan, learns why the opening position occurred, and then chooses legal learned or emergency moves under bounded uncertainty. Important actions can change damage, stamina, control, openings, position, finish pressure, later availability, and the opponent's response.

Move matchups are semantic, not category rock-paper-scissors. Authored threat and counter tags cover punches, low kicks, committed kicks, pressure, takedowns, clinch entries, cage pressure, ground strikes, submissions, position advances, and escapes. A move is favored only when its counter tags intersect the opponent move's threat tags and the opponent has no reciprocal counter; reciprocal or absent matches are neutral. The initial favored/exposed modifiers remain +12 / -14. A sprawl can counter takedowns but never punches or low kicks; kick checks counter only relevant kicks; anti-shot strikes counter takedowns.

One pure exchange-factor ledger is the authority for option odds, exchange resolution, coach selection, UI tags, and narration. Every factor identifies its source, affected side, target, magnitude, and localized Traditional Chinese/English reason. These consumers must not independently recompute or invent causality. Narration may mention only active factors; defensive clean outcomes use defensive or counter language rather than claiming that every defense “hit cleanly.” Round-entry narration names the selected plan and the position actually resolved.

### 6.1 Combat control modes — Accepted

Character creation offers two permanent per-career combat controls. **戰術操作** preserves position-specific move choice. **教練帶領** keeps opponent selection, camp choices, round plans, and between-round corner adjustments under player control, while the coach selects the highest-ranked legal learned or emergency move for each exchange using the same contextual combat scoring as the manual option list. It is not a separate combat ruleset: learned moves, injuries, stamina, traits, scouting, openings, adaptation, positions, and outcome formulas remain identical.

Round plans establish a contested opening rather than promise control: **尋找抱摔** resolves to top guard, neutral clinch, or bottom guard based on the opening margin; **尋找纏抱** resolves to a favorable Thai clinch, neutral clinch, or defensive Thai clinch; and **籠邊消耗** requires a clearly positive margin for cage control, with narrow margins becoming neutral cage contention and negative margins becoming cage defense.

Mount and back control remain full payoff positions. Thai clinch and front-headlock remain distinct internal states for legal moves, combat effects, and save compatibility, but player-facing presentation treats them as temporary control advantages layered over clinch and scramble. Prepared position chains matter: underhook control can convert a contested double-collar entry, flattened hips can convert a contested guard pass, an exposed or flattened opponent can convert a contested back take, and forward weight can convert a contested snapdown. A clean sprawl against an actual wrestling transition may also establish front-headlock control. These conversions change the destination of a contested transition rather than globally increasing its success chance.

Entering Thai-clinch or front-headlock control grants one immediate position-specific follow-up at the same tactical stage. Mount or back control first established on the fourth exchange also grants one follow-up before the bell. The follow-up uses normal stamina, damage, finish, and counter rules, cannot recursively create another free follow-up, and then resumes the normal four-exchange clock. This guarantees one readable use of a rare position without carrying position across rounds or granting unlearned moves.

Coach-guided exchanges show only the newest readable update, keeping the current position image visible. The player advances each coach-selected exchange with an explicit next-step button; this is a pacing control, not a move-selection decision. The live feed is scoped to the current round and clears at the bell; the complete fight commentary remains available in the final report. Position-entry causality remains visible before the first exchange. Both player finish opportunities and opponent finish threats still interrupt for the existing playable TKO/submission minigames. Existing careers migrate to **戰術操作** so no active player loses direct control.

Color commentary remains visible beside the newest exchange in both manual and coach-guided combat. Manual mode may collapse the full prior narration, factors, and report, but must not hide the short color call inside that closed disclosure.

The offer screen does not repeat a generic coach speech above every contract cycle. Each offer card instead retains one concise, localized coach verdict that names that opponent's actual strongest branch, exploitable branch, and current risk tier. Coaching copy must reduce comparison effort or change the player's understanding of a matchup; decorative repetition is removed.

Grassroots is a fixed three-opponent trial for Normie starts. The player advances to the Amateur League only after defeating all three distinct opponents; losses and draws leave that opponent available. Each defeated opponent disappears permanently from later Grassroots offer cards, the screen shows `defeated / 3` progress, and paid offer refresh is unavailable because the roster is intentionally fixed. Migrated careers already admitted to a ranked league are never demoted; active Grassroots careers reconstruct completed slots only from attributable fight history or rival results and preserve any already-signed fight.

Action outcomes use transparent pixel-art pair sprites for eight authored visual families: punch, kick, takedown, clinch, ground strike, submission, position, and escape. Each family has a clean-success and countered-failure pose. Clean triangle chokes and guard armbars use a dedicated, mechanically legible triangle-armbar-from-bottom pose; other clean submissions retain the general submission pose so the illustration does not falsely turn every finish into a bottom attack. The clean or countered pose remains visible while the player reads the result and chooses the next exchange; contested outcomes retain the normal position image and impact feedback. Artwork is presentation-only, is anchored to the same fixed arena camera (including the left inner cage edge and lower ground framing), and falls back to the position image when an old execution or asset cannot be resolved.

The submission finish minigame gives the player 15% more completion time than its original `0.26.0` tuning, for both attacking and defending windows. Starting progress, resistance, input-rate limit, completion threshold, and opportunity scaling remain unchanged; the leniency is exactly additional readable reaction time rather than a hidden outcome bonus.

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

### 6.2 Long-term body health — Accepted

Head, hands, knees, and torso health use tactical tiers `76–100`, `51–75`, `26–50`, and `11–25`. Tier effects apply through the exchange ledger; the existing 11–25 layoff choice and 10-or-below retirement rule remain unchanged.

| Part | Tactical effect by worsening tier | Per-fight wear source |
|---|---|---|
| Head | Defensive chance `0/-2/-5/-9`; incoming head finish pressure `0/+4/+9/+16%` | `min(8, floor(head damage / 18) + 2 when a head-led KO/TKO loss occurs)` |
| Hands | Punch chance `0/-2/-5/-9`; punch damage `0/-5/-10/-18%` | `min(6, floor(punch attempts / 8) + floor(countered committed punches / 4))` |
| Knees | Kick/wrestling-transition chance `0/-2/-5/-9`; relevant stamina cost `0/+1/+2/+4` | `min(8, floor(leg damage / 18) + floor(countered committed lower-body actions / 4))` |
| Torso | Action stamina cost `0/+1/+3/+5`; round recovery `0/-5/-10/-18%` | `min(8, floor(body damage / 15))` |

Long-term wear, current-fight body damage, action attempts, counters, and finish attribution must remain mechanically and narratively aligned. Health warnings name the affected part rather than presenting a generic penalty.

### 6.3 Fight settlement and consequences — Accepted

A fight settles exactly once when it ends while the game remains in the fight-result phase. Settlement stores a deterministic career-change summary and the next route; the result screen's Continue action only follows that stored route and never reapplies consequences.

The result shows actual changed values and omits unchanged fields: purse and funds, standing, record, age and year, readiness, every affected body-health part, relationship memories and explicit trust changes, trait evidence, reputation-band change, and world news. It must preserve a readable causal report rather than forcing the player to infer consequences from the next screen.

## 7. Relationships, events, and biography — Accepted

Coach, family, and training-partner relationships persist across the career. Track and surface them only where trust or shared history changes training, recovery, choices, callbacks, or the final biography.

- Coach trust modifies technique XP.
- Family trust modifies recovery.
- Training-partner trust modifies film study at 0.9× / 1.0× / 1.1× for strained / steady / trusted.
- Ordinary fight outcomes may add shared memories but never grant automatic coach or family trust. Trust changes only through an explicit shared decision.
- In camp, only relationships with a current mechanical effect need occupy persistent space. The affected activity retains the full causal explanation.
- Life events may trade money, fatigue, health, readiness, trust, and reputation, and should create a remembered consequence rather than isolated flavor text.

Failure should redirect, scar, constrain, or conclude a career meaningfully instead of invalidating the run. Retirement output must synthesize starting experience, final skill levels, signature moves, birth and earned traits, turning points, relationships, achievements, failures, and unrealized possibilities. Raw totals are secondary evidence, not the ending itself.

Fighter, relationship, and opponent generation must prevent identity collisions.

### 7.1 Relationship arcs — Accepted

Each of the three existing relationships receives one test and one conditional follow-up:

- Coach: game-plan disagreement, followed by honest repair when strained or advanced collaboration when trusted.
- Family: promise-versus-gym conflict, followed by repair or visible support.
- Training partner: extra opponent-simulation burden, followed by repair or deeper scouting collaboration.

A follow-up requires at least two fights since its first event and appears only when shared history or a trust-tier change makes it relevant. The defining relationship in a biography is selected from shared semantic history, not maximum trust.

### 7.2 Semantic history and contextual event scheduling — Accepted

History retains player-facing prose and tags while optionally attaching a discriminated semantic fact. Facts cover origin, fight, motive choice, relationship choice, promotion, trait, layoff, legacy, world change, and retirement. Migrations add facts only when existing state makes them reconstructable; absent evidence is not invented.

Camp no longer mandates an event. At most one event occurs before a fight, using this priority:

1. Actual medical need or signed-fight logistics.
2. A due motive beat.
3. A one-time legacy choice.
4. Relationship rupture, recovery, or payoff.
5. Eligible sponsorship or a one-time regional callback.
6. Otherwise proceed directly to pre-fight.

A medical event requires at least one health part below 90 and at least one option with nonzero projected benefit. Every event shows the affected current values, capped projected totals, affordability, any returning person's relevant memory, and exact actual consequences.

### 7.3 Motive arcs and opportunities — Accepted

All four motives have a first interactive beat eligible after two fights and a reckoning eligible after five fights and completion of the first beat. Urgent medical or logistics events may defer, but never erase, a due beat.

| Motive | First path and consequence | Reckoning consequence | Optional career opportunity |
|---|---|---|---|
| Family | Provider: extra work `+0.25` typical purse, `+6` fatigue, `-6` family trust. Presence: `-5` fatigue, `-1` readiness, `+8` trust. | Provider reserves one purse for security and gains `+10` trust. Presence protects shared time for `-3` readiness, `-8` fatigue, `+10` trust. | Provider creates one sponsor-backed ordinary offer; Presence strengthens the next family-assisted recovery. |
| Prove | Defiant: `+6` reputation, `+3` readiness, `+3` fatigue. Disciplined: `+10` scouting, `+4` coach trust. | Defiant: `+4` reputation, `+4` readiness, `+5` fatigue. Disciplined: `+1` Fight IQ, `+6` coach trust. | Defiant guarantees one legal fast-track or rival offer; Disciplined grants one prepared-move credit. |
| Honor | Loyalist: `+6` partner trust, `+5` fatigue, `+2` readiness. Builder: `+0.15` purse, `+3` reputation, `+3` coach trust. | Loyalist invests time for `+7` coach and partner trust, `-3` readiness. Builder spends `0.5` purse for `+5` reputation, `+8` coach trust and a gym-legacy fact. | Loyalist improves the next team-supported camp; Builder changes legacy and sponsorship callbacks. |
| Fame | Spotlight: media work `+0.25` purse, `+7` reputation, `+6` fatigue, `-2` readiness. Craft: `+5` coach trust and one prepared-move credit. | Spotlight accepts a headline opportunity. Craft gains `+10` scouting, `+2` reputation and another preparation credit. | Spotlight marks one high-risk offer with `+20%` purse and `+6` reputation on victory; Craft strengthens fight-specific preparation. |

Motive opportunities never block normal offers, rank movement, title eligibility, or retirement. They expire after three offer cycles. An impossible fast-track or rematch converts to one prepared-move credit. Two choices from the same path resolve that path; split choices resolve as conflicted or nuanced, and the unused path becomes the biography counterfactual.

### 7.4 Reputation and rival memory — Accepted

Promoter trust is removed. Reputation persists as public career meaning rather than a combat or access gate. Its bands are `0–14 Unknown`, `15–34 Local prospect`, `35–54 Noted contender`, `55–74 Headline draw`, and `75–100 Era-defining name`. UI shows named bands and qualitative change, never a raw meter.

Reputation changes are: ordinary win `+2`, draw `+1`, finish `+1`, fast-track/upset `+2`, title win `+6`, successful defense `+3`, and ordinary loss `0`. Reputation influences motive and sponsorship eligibility, public-legacy wording, biography, and replay comparison only; it never modifies combat, rank, title eligibility, or base purse.

After each fight, bounded rival memory stores the last result and method, the most-used move when used at least twice, and the most-used branch when used at least three times. It retains at most one move and one branch pattern, replacing each with the latest meeting. A rematch preloads those adaptation keys at strength one and explains the remembered pattern on offer and briefing screens. First meetings and migrated legacy rematches receive no invented tactical pattern.

### 7.5 Retirement biography — Accepted

The retirement biography is a curated causal account, not a log dump. It selects six to eight beats in this order when evidence exists: origin, motive, peak achievement, defining setback, relationship decision, rivalry with an opponent met at least twice, legacy, and retirement. The complete timeline remains expandable beneath it.

The defining rival is chosen by meetings, title or close-fight importance, then recency. Signature moves are the two highest recorded-use non-emergency moves, with finishing uses weighted twice; a merely learned move cannot qualify. The structured outcome includes motive resolution, style branches, signatures, traits, titles, defining person and rival, financial legacy, retirement cause, and unrealized path. Selection is evidence-based and deterministic.

### 7.6 Career identity, replay, and comparison — Accepted

Every career receives a unique non-simulation `careerId` generated with browser cryptography; this must not consume gameplay RNG. Biography IDs use the career ID so same-seed archives cannot overwrite each other. Creation persists the raw inputs, including an empty generated-name input, so replay preserves identity-stream consumption.

**Replay this seed** opens editable creation with seed and authored setup prefilled, assigns a new career ID, and joins the same replay group. A comparison is labelled controlled only when seed, exact setup, rules version, and content version all match. Any setup or version mismatch shows an explicit warning. Comparison covers record, retirement, titles, skills, signatures, traits, motive, relationship, rival, reputation band, and curated beats.

## 8. RNG, seeds, saves, and reproducibility — Accepted

The seed supports alternate-life comparison, sharing, and debugging. Randomness is split into named streams for identity, opponents, offers, events, fights, and cosmetics so presentation-only changes do not silently rewrite a career.

Given the same rules/content versions, seed, and player choices, aptitude, background, birth traits, move offers, opponents, and career outcomes should reproduce. Branching player choices may reroute later random consumption.

Rules, content, and save versions are part of the reproducibility contract. A breaking rules change may reset active careers with an explanation; archived biographies should be preserved whenever their stored data remains readable. Migrations must return a save stranded in a retired phase to a valid decision point and restore any consumed camp slot where appropriate.

The v0.5.0 version contract is save schema `16`, rules `0.26.0`, content `1.7.0`, and biography schema `2`; IndexedDB schema remains unchanged. The loader first normalizes every older supported save to the current v15 shape and then passes exactly once through v16.

The v16 migration preserves phase, RNG streams, signed and unsigned offers, camp slots, active event or result, relationships, history prose and order, opponents and meetings, records, and fight state. An already-started fight completes under its saved `0.25.0` combat rules; all newly started fights use `0.26.0`. Active offers are never regenerated, and migration never invents motive decisions, signature use, or rival tactics. Existing opponent records remain as stored even when implausible; corrected generation applies only to new careers and future world updates.

Migration removes promoter trust while preserving reputation, derives legacy career IDs from seed plus envelope timestamp without consuming gameplay RNG, and marks ambiguous creation input as `legacy-partial`. Such a replay opens prefilled creation for review but cannot claim a controlled comparison. Archived biographies upgrade best-effort to schema two while preserving their original prose, IDs, timeline, and recovered titles.

### 8.1 Persistent opponent world — Accepted

New opponents receive plausible ages and records derived from league, age, and rank strength. Records include draws, and long undefeated records are exceptional. Regional identity generation uses exact home / neighbor / Asian-visitor mixes: Hong Kong `50/25/25`, Taiwan `65/20/15`, and Mainland China `75/15/10`.

On each player-year advance, only the named world RNG stream ages active opponents and resolves zero to two non-ranking record bouts. Opponents retire at a deterministic age from 36 through 40; a signed opponent scheduled to retire completes the contracted fight first. Retired opponents remain historical records and receive a unique deterministic successor in the same champion or numbered slot, with lineage retained. Offscreen results never reorder ranks.

Each year may produce up to three non-blocking world-news items, prioritizing current-league champions, known rivals, and retirements. World simulation is reproducible and cannot consume identity, offer, event, fight, or cosmetic RNG streams.

## 9. Economy — Accepted

Money represents **career optionality**, not survival or permanent combat power. Early funds provide medical and logistical breathing room, mid-career savings provide control over contracts and timing, and late-career money can become generosity, security, or legacy.

- Starting funds, purses, sponsorships, and event rewards remain the main sources. Stage base purses for Grassroots / Amateur / Regional / Asia / World / Legacy are respectively `1,000 / 4,000 / 12,000 / 30,000 / 75,000 / 100,000`. A title bonus equals one stage base. Existing opponent-risk and 20% short-notice adjustments remain. Fight count alone never increases purse.
- The interface derives `資金吃緊`, `有緩衝`, or `可自主選擇` from current funds relative to a typical stage purse. This runway description is not stored and has no direct modifier.
- Once per offer cycle, a fighter may spend roughly 35% of a typical purse to replace the current offers without advancing a year. The ordinary offers and free decline-with-time route remain available.
- Paid medical or logistical support mitigates immediate risk. An unaffordable option is visibly unavailable and every event retains a viable non-monetary route through time, risk, or relationship obligation.
- At most one economy decision appears around a fight. A paid offer replacement consumes that fight's economy slot; otherwise contextual short-notice, first-away, medical, sponsorship, or legacy choices can replace the ordinary life event rather than adding another management screen.
- Late-career choices may invest approximately one typical purse in the home gym or preserve funds while contributing time or securing retirement. These choices affect relationships, reputation, history, and biography rather than combat ability.
- Base training, move learning, fight entry, and authored emergency actions never cost money. There is no debt, interest, mandatory upkeep, equipment tier, purchased XP, purchased move, or permanent rating purchase.
- Major financial choices enter history and can be synthesized in the retirement biography. Routine transactions remain totals rather than narrative events.

Regional multipliers apply consistently to local base purse, title bonus, medical, logistics, sponsorship, offer refresh, and legacy costs. Balance should keep zero-money careers fully completable, make spending understandable and tempting without creating an automatic option, and limit the competitive gap between low- and high-fund careers.

## 10. Interface principles — Accepted

`UI_PRINCIPLES.md` is the detailed authority for interface work. In particular, the game is mobile-first, Traditional Chinese is the primary player-facing language, the current decision must dominate the screen, and cause/effect must remain legible.

The status UI should show each branch's derived 0–100 combat ability alongside its player-facing strength label and XP. Status strength badges are `未受訓`, `初學`, `中階`, `熟練`, `進階`, and `大師` for levels 0–5 respectively; do not use raw `Lv.` notation for those fighter-strength badges. The screen should also emphasize aptitude, learned moves, traits, trait discovery progress, injuries, current objective, and recent changes. The ability value must come from the canonical skill-rating mapping rather than presenting a stale compatibility field. It must not revive the old tech-tree or present every stored compatibility field as meaningful player state.

The compact career context strip presents only preparation, lowest health, and career funds. Skill and move detail belongs in the status surface and the selected camp branch card, not in a persistent summary tile. The most recent camp-result summary appears before the technical-focus selector so the outcome is visible before the next training choice. Camp training cards already name their normal-completion and optional challenge actions, so a separate explanatory banner is unnecessary.

Character reveal shows the fighter's actual learned moves but does not include a generic emergency-action explainer; those safety fallbacks are presented only when relevant in combat.

Coach-guided combat remains explicitly player-paced: one click produces exactly one exchange, waiting changes nothing, and dispatch is guarded so a double input cannot advance twice. Buttons use stateful labels for the first exchange, next exchange, and finish interruption. Coach mode preserves the reading position and keeps Continue sticky. Autoplay and “continue to bell” are not part of the accepted design.

Manual combat returns the scroll position to the cage arena after every resolved move so the visual outcome is immediately visible before the player reads the collapsed result and chooses again. The arena is a programmatic focus target outside the normal tab order, preserving an accessible state-change announcement without forcing keyboard users through a duplicate control. Earlier narration collapses into **Previous exchange**, with the complete report behind disclosure. The mobile action dock uses normal layout without negative positioning and respects device safe areas at both 320×568 and 320×720; essential actions must remain visible, operable, and at an appropriate touch size.

Character-creation choices use true radio semantics, keyboard operation, visible focus, and a compact selected-setup summary. The browser-tab PWA prompt remains visible and is suppressed only in standalone mode. Every touched surface uses explicit Traditional Chinese and English message IDs; no new hard-coded English or DOM-translation dependency may be introduced.

### 10.1 v0.5.0 scope boundaries — Accepted

This revamp adds no equipment tiers, debt, upkeep, paid power, weight cutting, side control, talent tree, practical sparring, new relationship cast, or coercive retention mechanic. Existing arena art and action sprites are reused; no new visual-asset pipeline is required.

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
- Every one of the 19 positions exposes at least two authored emergency actions; a level-0 fighter always has a legal action, and no unlearned ordinary move appears in combat, training, evidence, or biography.
- Each seeded background starts with its documented identity move.
- The reachable ground chain is guard, mount, and back control; side control and its dedicated moves are absent.
- A Normie's first 100 XP in every branch automatically grants its functional three-move foundation; the first ground foundation includes an escape route and the first wrestling foundation includes a real takedown.
- The first 100-XP milestone grants its fixed toolkit without a selection. Each later 150-XP milestone offers up to four moves and requires one selection before the move is learned. Sessions that do not cross a milestone grant no move.
- XP thresholds, aptitude, relationship, and trait modifiers are correct and visible.
- Semantic matchup tests prove narrow counters and neutral reciprocal interactions; option odds, resolution, coach choice, UI, and narration agree with the same exchange-factor ledger.
- Every trait's active, inactive, limit, and trade-off behavior is tested on both player and opponent sides, including independent once-per-round activation and `submission-sense` failure cost.
- Health-tier chance, damage, stamina, recovery, finish pressure, and exact post-fight wear map to the documented body part and boundary.
- Prepared moves grant +6 exactly once in the signed fight, never stack, and expire; loss lessons derive from the largest negative ledger factor.
- Trait evidence uses the correct finish method and move attribution, awards once, and persists to history and biography.
- All three starting experiences remain viable; the longest route is not automatically optimal.
- Every league has one champion with no numeric rank and a unique #1–#15 table; identical seeds produce identical league rosters and preserve the intended rating curves.
- Normie Grassroots entry, unranked placement, rank shifts, displacement below #15, losses, draws, rematches, and per-league title-form resets remain causal and player-driven.
- Championship requirements are enforced at their exact boundaries (top three and rating floors 35 / 50 / 70 / 80); optional fast-track cards target a materially higher-ranked opponent and use ordinary causal rank placement; challenge, defense, belt turnover, promotion, and World-to-Legacy behavior are distinct.
- Competitive rating is tested at every league floor and rank-three/rank-four boundary. A defensive-literate specialist can qualify; an untrained one-discipline specialist cannot.
- Offer, standings, promotion, accessible-label, and 320 px UI surfaces expose league standing without rendering a champion as a number.
- Legacy active careers migrate to World, old global ranks map with `ceil(oldRank × 15 / 99)`, and current records, title history, RNG state, signed fights, and unsigned offers are preserved without regeneration.
- Seeded height, reach, natural weight, and frame persist for each opponent; range, pressure, takedown, and clinch outcomes receive only the documented small body-matchup edges, while displayed division remains non-mechanical.
- Every supported legacy save first normalizes to v15 and migrates once to v16 without regenerating offers or rewriting signed fights. Started fights retain rules `0.25.0`; new fights use `0.26.0`. Fixtures cover active camp, event, critical exchange, finish window, result, league choice, injury recovery, and retirement.
- Motive beats cover both paths for all four motives; scheduling proves event priority and direct no-event flow. Relationship callbacks, reputation bands, bounded rival inheritance, biography selection, replay grouping, and setup/version warnings remain evidence-based.
- Fixed-seed cohorts reproduce regional identity mixes, plausible records, opponent aging and replacement, successor uniqueness, unchanged offscreen rank order, and prioritized world news.
- A fight settles once before result acknowledgement; the stored career-change summary matches applied state and Continue cannot duplicate it.
- Fight count never triggers retirement, while age 38 and post-fight health at 10 or below do; 11–25 requires choosing the documented medical layoff or immediate voluntary retirement before the career can continue.
- Offer, status, injury-layoff, and injury-retirement surfaces state the health rule and current relevant condition.
- Retired practical-sparring state migrates back to a playable camp without losing a slot.
- The primary gameplay path remains usable at 320×568 and 320×720 without horizontal scrolling, unsafe-area overlap, or hidden essential actions. Coach mode advances exactly one exchange per click and none while waiting and preserves its reading position; every resolved manual move returns the cage arena to view.
- Character creation radios, challenge preflight and controls, event projections, post-fight deltas, replay comparison, both locales, and browser-tab versus standalone PWA behavior are covered by browser tests.

Balance simulations and automated tests are evidence, not substitutes for playtesting. A new activity must also prove that its choices change later state, that players can understand the consequence, and that it creates a next question worth caring about.

### 12.1 v0.5.0 fresh-player production gate — Accepted

Production deployment of v0.5.0 requires five fresh players. Across the group, all four motives must be represented; three careers use manual combat, two use coach-guided combat, and one pair replays the same seed. Each player completes at least six fights or voluntarily retires after fight five.

At least four of the five players must be able to recount, without being shown the implementation checklist: their motive; one player-caused turning point; a defining person or rival; the unrealized path; one truthful semantic combat cause; and a distinct hypothesis for what they would try in another run. Any impossible matchup explanation, hidden essential action at 320 px, lost save, or biography overwrite blocks release immediately. If fewer than four players pass causal retelling, revise the career-memory and biography slice instead of adding more content.

Automated tests, simulations, and developer playthroughs do not satisfy this human gate. Until the evidence above is recorded, the release may be implementation-complete but must not be pushed to production.
Use [PLAYTEST_GATE_v0.5.0.md](PLAYTEST_GATE_v0.5.0.md) to record the five sessions and release decision without fabricating evidence.

## 13. Consolidated decision record

This is a decision summary, not a transcript. Superseded implementation discussion is intentionally omitted.

| Date | Status | Decision and rationale |
|---|---|---|
| 2026-08-28 | Accepted | Replace talent points and the tech tree with five level 0–5 XP skills. Progress should produce learned moves and a recognizable fighting identity. |
| 2026-08-28 | Accepted | Technique training always creates a move-specific consequence: a milestone grants a real learned-move choice, while a non-milestone session prepares its focused learned move for the signed fight. |
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
| 2026-08-29 | Accepted | Competitive rating weights strongest skill / second skill / Fight IQ / average defensive coverage at 45% / 20% / 20% / 15%. Learned defenses and transitions require branch level one to count, allowing defensively literate specialists without qualifying pure one-branch builds. |
| 2026-08-29 | Accepted | Use a 50–70 XP pre-modifier technique range with 100% / 85% / 70% first-to-third same-branch camp efficiency. The first session can make a Normie functional, while concentrated training does not trivialize later fights. |
| 2026-08-29 | Accepted | Tie move acquisition directly to skill growth: the first 100 XP automatically grants a three-move level-one attack/defense/transition foundation, while every later 150-XP milestone unlocks one selected move. Every session follows aptitude-sensitive XP. |
| 2026-08-29 | Accepted | A Normie begins without learned ordinary moves and relies on at least two authored emergency actions in every position until training supplies a foundation. Background starts guarantee one identity move. Emergency actions never become progression or biography evidence. |
| 2026-08-29 | Accepted | Expand performance-earned traits using recorded fight evidence, so more careers gain distinct milestones without random post-fight loot. Add the legendary growth-only birth trait `戰鬥天才`: +12% technical XP in every branch and +1 Fight IQ from film study, with no direct combat bonus. |
| 2026-08-29 | Accepted | Keep XP and 150-XP move milestones active after a branch reaches `大師`, while holding the level-five combat rating at 96. Same-branch camp repetition stays at 100% / 85% / 70% and changing branches carries no repeat penalty. |
| 2026-08-30 | Accepted | Offer permanent per-career **戰術操作** and **教練帶領** controls at character creation. Coach-guided combat retains player round plans and corner choices, uses the same legal-move and combat scoring model to choose exchanges automatically, presents those exchanges as a readable live feed, and preserves playable TKO/submission windows for both attack and defense. |
| 2026-08-30 | Accepted | Keep the automatic 100-XP three-move foundation, then reduce every later move-selection interval from 175 XP to 150 XP. Each interval offers up to four eligible moves and requires one choice. |
| 2026-08-31 | Accepted | Replace category matchup heuristics with authored semantic threat/counter tags and make a single localized exchange-factor ledger authoritative for odds, resolution, coach choice, UI, and truthful narration. Apply contextual traits symmetrically and body-specific health tiers exactly. |
| 2026-08-31 | Accepted | Limit Push for an edge to once per camp; require accessible preflight before timed input; add a visible first-use +6 prepared move; and turn the largest negative factor after a loss into the next camp's rebuild lesson. |
| 2026-08-31 | Accepted | Ordinary fight results create memories but never automatic relationship trust. Coach, family, and training partner each receive one explicit test and evidence-gated follow-up, and their trust modifies technique, recovery, and film study respectively. |
| 2026-08-31 | Accepted | Replace mandatory camp events with a one-event contextual priority scheduler. Author two beats and two paths for Family, Prove, Honor, and Fame; motive opportunities remain optional and expire or convert without blocking the career. Remove promoter trust and keep reputation as qualitative public legacy only. |
| 2026-08-31 | Accepted | Attach reconstructable semantic facts to history, retain bounded tactical rival memory, settle each fight once with explicit consequence deltas, and synthesize retirement into six to eight evidence-selected beats plus the complete timeline. |
| 2026-08-31 | Accepted | Give every run a cryptographic career ID outside gameplay RNG. Same-seed replay preserves raw creation inputs, creates a new archive-safe identity, and calls a comparison controlled only when setup and rules/content versions match exactly. |
| 2026-08-31 | Accepted | Use fixed stage purses, consistent regional economics, plausible opponent age/record generation, exact regional identity mixes, world-stream-only annual aging and record bouts, deterministic retirement successors in place, and non-blocking prioritized world news. Offscreen results never move ranks. |
| 2026-08-31 | Accepted | Preserve explicit click-to-advance coach pacing with no autoplay. Harden mobile scroll anchors, safe areas, action visibility, creation radio semantics, PWA mode detection, and explicit Traditional Chinese/English message IDs. |
| 2026-08-31 | Accepted | Ship the revamp as backward-compatible package 0.5.0 with save 16, rules 0.26.0, content 1.7.0, and biography schema 2. Preserve active state and started fights without inventing historical facts. |
| 2026-08-31 | Accepted | After every resolved move in manual combat, return the viewport and programmatic focus to the cage arena so the player sees the visual outcome before making the next choice. Coach-guided reading position remains unchanged. |
| 2026-08-31 | Accepted | Show clean triangle chokes and guard armbars with a dedicated triangle-armbar-from-bottom sprite while preserving other submission poses, and make both attacking and defending submission minigames 15% more lenient through additional completion time only. |
| 2026-08-31 | Accepted | Remove the repeated generic coach speech from contract selection. Preserve only localized, opponent-specific card verdicts that identify actual risk, strongest weapon, and exploitable branch. |
| 2026-08-31 | Accepted | Keep color commentary visibly outside collapsed exchange detail in both combat modes. Make Grassroots a fixed three-opponent checklist: only distinct wins advance, defeated opponents disappear, losses/draws remain available, and existing ranked careers are not demoted. |
