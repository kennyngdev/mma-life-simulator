# Workspace guidance

This repository is the independent home of the Traditional Chinese wuxia life simulator 《大俠模擬器》. It is not coupled to the original campaign game.

## Change routing

- UI and player flow: `app/page.tsx`
- Life simulation, seeded RNG, progression, relationships, encounter generation, and endings: `app/life-engine.ts`
- Battle transitions and battle types: `app/battle/`
- Layout and responsive behavior: `app/game.module.css` and `app/globals.css`
- Product principles: `docs/DESIGN_PRINCIPLES.md`
- UI constraints: `docs/UI_PRINCIPLES.md`
- Story voice: `docs/WRITING_PRINCIPLES.md`

Before changing game behavior, read `docs/DESIGN_PRINCIPLES.md`. Before changing UI, also read `docs/UI_PRINCIPLES.md`. Before changing player-facing story or event copy, also read `docs/WRITING_PRINCIPLES.md`.

Keep the life engine and battle engine deterministic: the same version, seed, identity, difficulty, and choices must reproduce the same run. Update the relevant principle document when a material product or UI decision changes.

Port **3010 is permanently reserved for the user's playtest server**. Keep `pnpm dev` running there when the user is playtesting. Agents must not bind, stop, restart, or reuse port 3010 for their own previews; use `pnpm dev:agent` on 3011 or explicitly choose another free non-3010 port.

Useful commands: `pnpm dev` (user playtest on 3010), `pnpm dev:agent` (agent preview on 3011), `pnpm test`, `pnpm lint`, and `pnpm build`. Node.js 22.13 or newer is required.
