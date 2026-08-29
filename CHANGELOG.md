# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-29

### Added

- Added an accepted Threads promotion specification covering Traditional-Chinese audience positioning, content cadence, community engagement, player-feedback intake, moderation, and success measurement.
- Added clearly labeled fast-track fight cards, letting players voluntarily face a substantially higher-ranked opponent for faster, causally earned ladder movement; existing unsigned offer sets migrate to include them without altering signed fights.
- Added the legendary birth trait `戰鬥天才`, increasing every technical training XP gain by 12% and granting an extra Fight IQ from film study without direct combat bonuses.
- Added six performance-earned traits for takedowns, knockdowns, finishes, decision experience, wins, and surviving finish windows.

### Changed

- Replaced the combat scene's SVG block fighters with transparent pixel-art PNG pair sprites for standing, clinch, cage, ground, back-control, and scramble positions.
- Positioned cage-fight characters against the inner edge of the pixel-art fence, preserving clear ringside pressure without overlapping the foreground.
- Gave Amateur, Regional, Asia, and World fights distinct pixel-art arenas while locking every league to the same front-facing cage camera angle.
- Replaced the combat-position scene with an original pixel-art MMA gym backdrop and readable pixel fighters while keeping each position's control direction clear.
- Clarified the cage-control scene by placing the player and opponent labels over their respective fighters, and corrected the facing direction in the cage-defense illustration.
- Slowed move progression: the first move unlocks at 100 XP, while each later move requires another 175 XP. The first lesson now follows the same aptitude-sensitive XP formula instead of bypassing talent to force the foundation milestone.
- Made the first 100-XP milestone a complete three-move level-one branch toolkit (attack, defense, transition). Normies now begin with only two weak learned actions per branch—attack/defense for boxing and kicking, defense/escape for clinch, wrestling, and ground—while Hobbyists and Semi-pros begin with the foundations appropriate to their trained branches. Removed the hidden universal moves that had bypassed those starting kits.
- Recenters ranked fight cards on opponents comparable in both overall rating and lead capability when a fighter's current strength has outgrown or fallen behind their standing; component compatibility has equal selection weight to rank distance, while rank-based progression and the voluntary fast-track challenge remain intact.
- Increased the normal-card rematch penalty so comparable matchmaking retains career variety instead of repeatedly surfacing the same rival.
- Recalibrated competitive rating to weigh the strongest discipline at 40%, second at 20%, remaining breadth at 20%, and fight IQ at 20%. This keeps specialist progress visible without overstating a one-dimensional fighter's full-MMA readiness; `0.22.0` saves re-rate rosters and rebuild unsigned cards as `0.23.0`.
- Removed the two-consecutive-wins requirement from championship challenges; top-three standing and the league's competitive-rating floor remain required.
- Tied move acquisition to XP milestones, making aptitude and training quality affect when a fighter earns the next move; sessions that fall short refine existing technique without granting a move.
- Slowed technique training further and strengthened diminishing returns for a camp's second and third technique sessions. Repeatedly stacking technique work no longer makes the middle and late career too easy, while emergency actions keep an untrained fighter playable before their first move unlock.
- Rebalanced competitive rating so every MMA discipline contributes: the two strongest skills still define 60% of the score, while the other three skills now contribute 20% alongside 20% fight IQ. Existing careers migrate without losing signed fights, and generated league ratings remain aligned with the new model.
- Added independent Amateur, Regional, Asia, and World top-15 leagues with champion-only title status, causal rank movement, championship defenses, promotion choices, and deterministic save migration. Seeded height, reach, natural weight, and frame continue to create only subtle tactical matchup effects; existing `0.12.0 / 1.5.0` and `0.12.1 / 1.5.1` saves retain deterministic league and opponent body data through the current `0.23.0 / 1.6.0` migration.
- Established the official product name as **拳途人生 Cage Life** across the game shell, PWA metadata, sharing text, and design specification.
- Adopted Semantic Versioning and a required changelog workflow for future repository changes.
- Prepared GitHub Pages to serve the production site from `playcagelife.com` at the root path.
- Declared GitHub Pages at `playcagelife.com` the sole production hosting path; ChatGPT Sites is not used for this game.
- Added a Traditional-Chinese PWA install/add-to-home-screen prompt to character creation for browser-tab players.
- Removed the legacy ChatGPT Sites build integration so GitHub Pages is the only deployment target.

## [0.1.0]

### Added

- Initial playable release of 拳途人生.
