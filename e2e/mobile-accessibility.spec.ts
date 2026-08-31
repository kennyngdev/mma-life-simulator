import { expect, test } from '@playwright/test'
import { emulateStandaloneDisplayMode, horizontalOverflowPx, installCoachFightFixture, readStoredFightProgress, resetCageLifeStorage } from './helpers'

test.describe('creation and mobile accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await resetCageLifeStorage(page)
  })

  test('creation uses keyboard-operable radios, a live summary, and no horizontal overflow', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '拳途人生 Cage Life' })).toBeVisible()
    await expect(page.getByRole('note', { name: '以 App 模式踏進鐵籠' })).toBeVisible()

    const taiwan = page.getByRole('radio', { name: /台灣.*拳館網絡/ })
    const hongKong = page.getByRole('radio', { name: /香港.*國際門戶/ })
    await expect(taiwan).toBeChecked()
    await taiwan.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(hongKong).toBeChecked()
    await expect(page.getByLabel('目前選定的生涯設定')).toContainText('香港 · 證明自己 · 業餘愛好者 · 戰術操作')

    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
    const undersizedTargets = await page.locator('button, .region-choice, .setup-radio-card').evaluateAll((nodes) => nodes
      .map((node) => ({ text: node.textContent?.trim().slice(0, 24), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width }))
      .filter((box) => box.height < 44 || box.width < 44))
    expect(undersizedTargets).toEqual([])
  })

  test('English creation keeps explicit labels and the browser-tab install prompt', async ({ page }) => {
    await page.goto('/?lang=en')
    await expect(page.getByRole('heading', { name: 'Cage Life' })).toBeVisible()
    await expect(page.getByRole('note', { name: 'Step into the cage in app mode' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Taiwan.*Gym network/ })).toBeChecked()
    await expect(page.getByLabel('Selected career setup')).toContainText('Taiwan · Prove yourself · Amateur hobbyist · Tactical control')
    await expect(page.getByRole('button', { name: 'Begin fighter career' })).toBeVisible()
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)
  })

  test('the first in-game action dock remains visible and header targets stay usable', async ({ page }) => {
    await page.getByLabel('拳手姓名（選填）').fill('行動鈕測試')
    await page.getByRole('button', { name: /開始拳手生涯/ }).click()
    await expect(page.getByRole('heading', { name: '命運揭曉' })).toBeVisible()

    const dock = page.locator('.action-dock')
    await expect(dock.getByRole('button', { name: '從這裡開始' })).toBeVisible()
    const dockGeometry = await dock.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { bottom: rect.bottom, viewport: window.innerHeight, position: getComputedStyle(element).position }
    })
    expect(dockGeometry.position).toBe('sticky')
    expect(dockGeometry.bottom).toBeLessThanOrEqual(dockGeometry.viewport + 1)
    expect(await horizontalOverflowPx(page)).toBeLessThanOrEqual(1)

    const headerTargets = await page.locator('.header-actions button').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
    expect(headerTargets.every((height) => height >= 44)).toBe(true)
  })

  test('a camp challenge waits for an explicit Start before mounting timed controls', async ({ page }) => {
    await page.getByRole('button', { name: /開始拳手生涯/ }).click()
    await page.getByRole('button', { name: '從這裡開始' }).click()
    await page.getByRole('button', { name: '簽下這場比賽' }).first().click()
    await expect(page.getByRole('heading', { name: '訓練營' })).toBeVisible()
    await page.getByRole('button', { name: '挑戰：爭取額外 XP' }).click()

    const start = page.getByRole('button', { name: '準備好，開始挑戰' })
    await expect(start).toBeFocused()
    await expect(page.getByText(/計時尚未開始/)).toBeVisible()
    await expect(page.getByText('標準收益底線')).toBeVisible()
    await expect(page.getByText('可能加成')).toBeVisible()
    await expect(page.getByText('無障礙節奏')).toBeVisible()
    await expect(page.locator('.camp-drill')).toHaveCount(0)
    await start.press('Enter')
    await expect(page.locator('.camp-drill, .training-tutorial')).toHaveCount(1)
  })

  test('coach mode advances exactly one exchange per click and never advances while waiting', async ({ page }) => {
    const fixture = await installCoachFightFixture(page)
    const firstExchange = page.getByRole('button', { name: '開始攻防 1/4' })
    await expect(firstExchange).toBeVisible()
    const initialFeed = await page.getByLabel('即時賽況').textContent()
    await page.waitForTimeout(800)
    await expect(firstExchange).toBeVisible()
    expect(await page.getByLabel('即時賽況').textContent()).toBe(initialFeed)
    expect((await readStoredFightProgress(page)).beats).toBe(fixture.initialBeatCount)

    await firstExchange.click()
    await expect.poll(async () => (await readStoredFightProgress(page)).beats).toBe(fixture.initialBeatCount + 1)
    await expect(page.getByRole('button', { name: '進入攻防 2/4' })).toBeVisible()
    await expect(page.getByLabel('即時賽況').locator('.color-call')).toBeVisible()
    const afterOneClick = await page.getByLabel('即時賽況').textContent()
    expect(afterOneClick).not.toBe(initialFeed)
    await page.waitForTimeout(800)
    expect(await page.getByLabel('即時賽況').textContent()).toBe(afterOneClick)
    await expect(page.getByRole('button', { name: '進入攻防 2/4' })).toBeVisible()
  })
})

test('standalone PWA mode suppresses the install prompt', async ({ page }) => {
  await emulateStandaloneDisplayMode(page)
  await page.goto('/?lang=zh-Hant')
  await expect(page.getByRole('heading', { name: '拳途人生 Cage Life' })).toBeVisible()
  await expect(page.getByRole('note', { name: '以 App 模式踏進鐵籠' })).toHaveCount(0)
})
