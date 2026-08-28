# Repository instructions

Before changing gameplay, progression, combat, content, balance, economy, biography, or player-facing UI, read [GAME_DESIGN_SPEC.md](GAME_DESIGN_SPEC.md). It is the canonical record of accepted, deprecated, and open design decisions.

For interface work, also read [UI_PRINCIPLES.md](UI_PRINCIPLES.md). The game is mobile-first and Traditional Chinese is the primary player-facing language.

Keep these rules while working in this repository:

- Preserve accepted decisions unless the user's current request explicitly replaces one.
- Treat open questions as unapproved; do not choose and ship a solution implicitly.
- Do not extend deprecated talent-tree, node-mastery, or practical-sparring systems. Legacy fields may remain only for derived combat values or save compatibility.
- If an explicit new decision changes the design baseline, update `GAME_DESIGN_SPEC.md` in the same change.
- Keep implementation, migrations, automated tests, and player-facing causal explanations aligned with the spec.
