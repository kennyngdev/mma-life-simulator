import { expect, test } from '@playwright/test'
import {
  horizontalOverflowPx,
  installBiographyComparisonFixture,
  installBottomSubmissionVisualFixture,
  installCampChallengeFixture,
  installEightBeatRetirementFixture,
  installFightResultFixture,
  installLegacyPartialBiographyFixture,
  installLifeEventFixture,
  installManualFightFixture,
  readStoredCampProgress,
  readStoredCareerIdentity,
  readStoredFightProgress,
  resetCageLifeStorage,
} from './helpers'

test.describe('v0.5 career and combat revamp flows', () => {
  test.beforeEach(async ({ page }) => {
    await resetCageLifeStorage(page)
  })

  test('manual combat consumes one choice, returns to the cage graphic, and collapses prior narration', async ({ page }) => {
    const fixture = await installManualFightFixture(page)
    const decisionAnchor = page.locator('[data-critical-decision-anchor]')
    await decisionAnchor.scrollIntoViewIfNeeded()
    await expect(decisionAnchor).toBeVisible()

    const option = page.getByRole('button', { name: new RegExp(fixture.conservativeLabel) }).first()
    await option.scrollIntoViewIfNeeded()
    await option.click()

    await expect.poll(async () => (await readStoredFightProgress(page)).beats).toBe(fixture.initialBeatCount + 1)
    const afterOneChoice = await readStoredFightProgress(page)
    expect(afterOneChoice.phase).toBe('critical')
    await expect(page.locator('details.previous-exchange')).toBeVisible()
    await expect(page.locator('details.previous-exchange')).not.toHaveAttribute('open', '')
    await expect(page.locator('.color-call')).toBeVisible()
    const arenaAnchor = page.locator('[data-combat-arena-anchor]')
    await expect(arenaAnchor).toBeFocused()
    await expect(page.locator('.position-scene')).toBeInViewport()
    const arenaImage = page.locator('.position-scene image').first()
    await expect(arenaImage).toHaveAttribute('href', /-pixel\.webp$/)
    const arenaHref = await arenaImage.getAttribute('href')
    const arenaResponse = await page.request.get(arenaHref!)
    expect(arenaResponse.ok()).toBe(true)
    expect(arenaResponse.headers()['content-type']).toContain('image/webp')
    expect(Number(arenaResponse.headers()['content-length'])).toBeLessThan(120_000)
    await expect.poll(async () => arenaAnchor.evaluate((anchor) => {
      const container = anchor.closest<HTMLElement>('.game-scroll')!
      return Math.abs(anchor.getBoundingClientRect().top - container.getBoundingClientRect().top - 12)
    })).toBeLessThanOrEqual(2)

    const scrollState = await page.locator('.game-scroll').evaluate((container) => {
      const anchor = container.querySelector<HTMLElement>('[data-combat-arena-anchor]')!
      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      return { scrollTop: container.scrollTop, anchorTop: anchorRect.top, containerTop: containerRect.top, containerBottom: containerRect.bottom }
    })
    expect(scrollState.scrollTop).toBeGreaterThan(0)
    expect(scrollState.anchorTop).toBeGreaterThanOrEqual(scrollState.containerTop)
    expect(scrollState.anchorTop).toBeLessThanOrEqual(scrollState.containerTop + 16)

    await page.waitForTimeout(700)
    expect(await readStoredFightProgress(page)).toEqual(afterOneChoice)
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })

  test('triangle-armbar result remains readable inside the 320px cage frame', async ({ page }, testInfo) => {
    await installBottomSubmissionVisualFixture(page)
    const scene = page.locator('.position-scene')
    await expect(scene).toBeVisible()
    await expect(scene.locator('.action-result-sprite')).toHaveAttribute('href', '/assets/action-bottom-submission-clean-pixel.webp')
    await expect(scene.locator('svg')).toHaveAccessibleName(/上一招三角絞奏效/)
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
    await scene.screenshot({ path: testInfo.outputPath('bottom-triangle-armbar-320.png') })
  })

  test('life event previews capped totals and reports the exact applied consequences', async ({ page }) => {
    await installLifeEventFixture(page)
    await expect(page.getByRole('heading', { name: 'Projection Test' })).toBeVisible()
    await expect(page.getByText('答應在重要時刻回家')).toBeVisible()

    const option = page.getByRole('button', { name: /Choose bounded support/ })
    const preview = option.locator('.event-option-effects')
    await expect(preview).toContainText(/信任 97 → 100（\+3）/)
    await expect(preview).toContainText(/資金 .*1,000.*800.*-.*300/)
    await expect(preview).toContainText('準備度 98 → 100（+2）')
    await expect(preview).toContainText('疲勞 2 → 0（-2）')
    await expect(preview).toContainText(/頭部健康 95 → 100（\+5）/)
    await expect(preview).toContainText('情報 96 → 100（+4）')
    await expect(preview).toContainText('戰術智商 99 → 100（+1）')
    await expect(preview).toContainText('名聲定位「尚未成名」→「地方新秀」')
    await option.click()

    const result = page.getByRole('dialog', { name: 'Choose bounded support' })
    await expect(result).toBeVisible()
    const effects = result.getByLabel('選擇造成的影響')
    await expect(effects).toContainText(/信任 \+3（97 → 100）/)
    await expect(effects).toContainText(/資金 -.*300.*1,000.*800/)
    await expect(effects).toContainText('準備度 +2（98 → 100）')
    await expect(effects).toContainText('疲勞 -2（2 → 0）')
    await expect(effects).toContainText('頭部健康 +5（95 → 100）')
    await expect(effects).toContainText('情報 +4（96 → 100）')
    await expect(effects).toContainText('戰術智商 +1（99 → 100）')
    await expect(effects).toContainText('名聲提升 · 現為「地方新秀」')
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })

  test('English life-event surface retains explicit localized projections and results', async ({ page }) => {
    await installLifeEventFixture(page, 'en')
    const option = page.getByRole('button', { name: /Choose bounded support/ })
    const preview = option.locator('.event-option-effects')
    await expect(preview).toContainText('Readiness 98 → 100 (+2)')
    await expect(preview).toContainText('Fatigue 2 → 0 (-2)')
    await expect(preview).toContainText('Scouting 96 → 100 (+4)')
    await expect(preview).toContainText('Fight IQ 99 → 100 (+1)')
    await option.click()
    const effects = page.getByRole('dialog', { name: 'Choose bounded support' }).getByLabel('Effects of this choice')
    await expect(effects).toContainText('Readiness +2 (98 → 100)')
    await expect(effects).toContainText('Scouting +4 (96 → 100)')
  })

  test('English post-fight surface lists the deterministic career-change summary', async ({ page }) => {
    await installFightResultFixture(page, 'en')
    const changes = page.getByLabel('Post-fight career changes')
    await expect(changes).toBeVisible()
    for (const label of ['Career funds', 'Record', 'League standing', 'Age', 'Career year', 'Readiness', 'Head health', 'Torso health']) {
      await expect(changes.getByText(label, { exact: true })).toBeVisible()
    }
    await expect(changes.getByText('League standing', { exact: true }).locator('..')).toContainText(/Regional league/i)
    await expect(changes.getByText(/World news after the fight/)).toBeVisible()
  })

  test('settled fight changes remain readable with a sticky safe action at 320px widths', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile geometry is covered by the two 320px projects.')
    await installFightResultFixture(page)
    const changes = page.getByLabel('賽後生涯變化')
    await expect(changes).toBeVisible()
    await expect(changes.getByText('生涯資金', { exact: true })).toBeVisible()
    await expect(changes.getByText('職業戰績', { exact: true })).toBeVisible()
    await expect(changes.getByText('年齡', { exact: true })).toBeVisible()
    await expect(changes.getByText('生涯年份', { exact: true })).toBeVisible()
    await expect(changes.getByText('準備度', { exact: true })).toBeVisible()

    const scroll = page.locator('.game-scroll')
    await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight })
    const dock = page.locator('.action-dock')
    await expect(dock.getByRole('button', { name: '繼續生涯' })).toBeVisible()
    const geometry = await dock.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const button = element.querySelector('button')!.getBoundingClientRect()
      return {
        top: rect.top, bottom: rect.bottom, viewport: window.innerHeight,
        buttonHeight: button.height, left: rect.left, right: rect.right,
      }
    })
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport + 1)
    expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(320)
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })

  test('same-seed comparison distinguishes controlled runs from changed setup and supports replay prefill', async ({ page }) => {
    await installBiographyComparisonFixture(page, 'en')
    await page.getByRole('button', { name: 'Hall of Fame · 3' }).click()
    const biographies = page.locator('.hall > article')
    await expect(biographies).toHaveCount(3)

    await biographies.nth(0).getByRole('button', { name: 'Compare' }).click()
    await biographies.nth(1).getByRole('button', { name: 'Compare' }).click()
    const validity = page.locator('.comparison-validity')
    await expect(validity).toHaveClass(/controlled/)
    await expect(validity).toContainText('Controlled same-seed comparison')

    await biographies.nth(1).getByRole('button', { name: 'Comparing' }).click()
    await biographies.nth(2).getByRole('button', { name: 'Compare' }).click()
    await expect(validity).toHaveClass(/warning/)
    await expect(validity).toContainText('Uncontrolled comparison')

    await biographies.nth(0).getByRole('button', { name: 'Replay this setup' }).click()
    await expect(page.getByRole('status')).toContainText('Preparing a same-seed replay')
    await expect(page.getByLabel('Fighter name (optional)')).toHaveValue('Controlled Fighter')
    await expect(page.getByLabel('World seed')).toHaveValue('E2E-SAME-SEED')
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })

  test('film-study challenge starts and completes entirely through keyboard input', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installCampChallengeFixture(page, 'film', 'en')

    const preflight = page.locator('.drill-preflight')
    await expect(preflight.getByRole('heading', { name: 'Start when you are ready' })).toBeVisible()
    const start = preflight.getByRole('button')
    await start.focus()
    await page.keyboard.press('Enter')

    const film = page.locator('.film-study-drill')
    await expect(film).toBeVisible()
    const analyze = film.getByRole('button')
    await expect(analyze).toBeVisible()
    await analyze.focus()
    await page.keyboard.press('Space')

    for (let prompt = 0; prompt < 3; prompt += 1) {
      const answer = page.locator('.choice-drill .drill-options button').first()
      await expect(answer).toBeVisible()
      await answer.focus()
      await page.keyboard.press('Enter')
    }

    await expect(page.locator('.camp-activity-summary')).toBeVisible()
    await expect(page.getByLabel('Latest training result')).toContainText('Challenge result')
    await expect.poll(() => readStoredCampProgress(page)).toEqual({
      phase: 'camp',
      campActions: ['film'],
      history: [{ kind: 'film', source: 'edge' }],
      edgeUsed: true,
    })
  })

  test('recovery challenge completes through genuine touch pointer cycles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Touch input is exercised on the two hasTouch mobile projects.')
    await installCampChallengeFixture(page, 'recovery', 'en')

    const tap = async (locator: ReturnType<typeof page.locator>) => {
      await expect(locator).toBeVisible()
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      expect(box).not.toBeNull()
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    }

    await tap(page.locator('.drill-preflight').getByRole('button'))
    await expect(page.locator('.recovery-drill')).toBeVisible()
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await tap(page.locator('.recovery-drill .recovery-control'))
    }

    await expect(page.locator('.camp-activity-summary')).toBeVisible()
    await expect(page.getByLabel('Latest training result')).toContainText('Challenge result')
    await expect.poll(() => readStoredCampProgress(page)).toEqual({
      phase: 'camp',
      campActions: ['recovery'],
      history: [{ kind: 'recovery', source: 'edge' }],
      edgeUsed: true,
    })
  })

  test('retirement renders all eight curated biography beats including legacy and ending', async ({ page }) => {
    const fixture = await installEightBeatRetirementFixture(page)
    const highlights = page.locator('section.biography-highlights')
    const renderedBeats = highlights.locator('ol > li')

    await expect(renderedBeats).toHaveCount(8)
    for (const title of fixture.titles) await expect(highlights.getByText(title, { exact: true })).toBeVisible()
    await expect(highlights.getByText(fixture.legacyTitle, { exact: true })).toBeVisible()
    await expect(highlights.getByText(fixture.endingTitle, { exact: true })).toBeVisible()
  })

  test('legacy-partial replay opens a reviewable prefill and starts a linked career with a new ID', async ({ page }) => {
    const source = await installLegacyPartialBiographyFixture(page, 'en')
    await page.getByRole('button', { name: 'Hall of Fame · 1' }).click()
    const biography = page.locator('.hall > article').filter({ hasText: 'Recovered Legacy Fighter' })
    await expect(biography).toBeVisible()
    await biography.getByRole('button', { name: 'Replay this setup' }).click()

    await expect(page.getByLabel('Fighter name (optional)')).toHaveValue('Recovered Legacy Fighter')
    await expect(page.getByLabel('World seed')).toHaveValue('E2E-LEGACY-REPLAY')
    await expect(page.locator('input[name="region"][value="hong-kong"]')).toBeChecked()
    await expect(page.locator('input[name="motive"][value="family"]')).toBeChecked()
    await expect(page.locator('input[name="starting-experience"][value="semi-pro"]')).toBeChecked()
    await expect(page.locator('input[name="combat-mode"][value="coach-guided"]')).toBeChecked()
    const replayNotice = page.locator('.replay-setup-notice')
    await expect(replayNotice).toBeVisible()
    await expect(replayNotice).toHaveClass(/warning/)
    await expect(replayNotice).toContainText(/review|uncontrolled|confirm/i)

    await page.getByRole('button', { name: /Begin fighter career/ }).click()
    await expect(page.getByRole('heading', { name: 'Destiny Revealed' })).toBeVisible()
    await expect.poll(() => readStoredCareerIdentity(page)).toEqual({
      careerId: expect.stringMatching(/.+/),
      replayGroupId: source.replayGroupId,
      replayOfCareerId: source.id,
      setupKind: 'exact',
      phase: 'reveal',
    })
    const replay = await readStoredCareerIdentity(page)
    expect(replay.careerId).not.toBe(source.id)
  })
})
