# Repository instructions

Before changing gameplay, progression, combat, content, balance, economy, biography, or player-facing UI, read [GAME_DESIGN_SPEC.md](GAME_DESIGN_SPEC.md). It is the canonical record of accepted, deprecated, and open design decisions.

For interface work, also read [UI_PRINCIPLES.md](UI_PRINCIPLES.md). The game is mobile-first and Traditional Chinese is the primary player-facing language.

Before drafting, scheduling, or publishing Threads promotion, read [THREADS_PROMOTION_SPEC.md](THREADS_PROMOTION_SPEC.md). It is the accepted baseline for audience, voice, cadence, feedback handling, measurement, and social-account conduct.

Keep these rules while working in this repository:

- Preserve accepted decisions unless the user's current request explicitly replaces one.
- Treat open questions as unapproved; do not choose and ship a solution implicitly.
- Do not extend deprecated talent-tree, node-mastery, or practical-sparring systems. Legacy fields may remain only for derived combat values or save compatibility.
- If an explicit new decision changes the design baseline, update `GAME_DESIGN_SPEC.md` in the same change.
- Keep implementation, migrations, automated tests, and player-facing causal explanations aligned with the spec.
- Keep public promotional claims aligned with the current live build and disclose when the game or a featured system remains in development.

## Versioning and changelog

- Use Semantic Versioning (`MAJOR.MINOR.PATCH`) in `package.json`; bump the version when preparing a release, using MAJOR for breaking save or player-facing compatibility changes, MINOR for backward-compatible features, and PATCH for backward-compatible fixes.
- Maintain [CHANGELOG.md](CHANGELOG.md) in Keep a Changelog format. Every repository change must add a concise entry under `Unreleased` in the same change; never rewrite or omit prior released entries.
- Before a release, move the relevant `Unreleased` entries into a dated version section and update `package.json` in the same commit.

## Publishing to GitHub Pages

The production site is deployed by `.github/workflows/deploy-pages.yml` whenever `master` is updated. The workflow builds `dist/client` with `VITE_BASE_PATH=/` and deploys it through GitHub Pages. Configure the production custom domain `playcagelife.com` in the repository's GitHub Pages settings. GitHub Pages is the sole production hosting path: do not create, deploy, or maintain a ChatGPT Sites version.

Reference checklist:

1. Review `git status` and preserve unrelated user changes.
2. Run `npm test`.
3. Run `VITE_BASE_PATH=/ npm run build` to validate the same base path used in CI.
4. Run `git diff --check`.
5. Commit the validated changes with a descriptive message.
6. Push `master` with `git push origin master`.
7. Check the `Deploy to GitHub Pages` workflow for the pushed commit and wait for a successful result.
8. Verify the live site at `https://playcagelife.com/`.

Do not commit `dist/` or create a separate `gh-pages` branch; GitHub Actions owns the Pages artifact and deployment.

## PWA entry experience

- Character creation must show the PWA install/add-to-home-screen prompt only when the game is not running in standalone PWA mode.
- Keep the prompt concise, in Traditional Chinese, and usable on a 320 px-wide viewport. Test both browser-tab and standalone-mode behavior when changing it.
