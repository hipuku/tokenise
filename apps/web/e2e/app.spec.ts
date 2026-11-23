import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const VIEWS = ['About this tool', 'Convert tokens', 'Compare a token', 'Check a file']

async function open(page: Page, view: string) {
  await page.goto('/')
  await page.getByRole('button', { name: view, exact: true }).click()
  // Let the nav's colour transitions finish, or axe measures a colour halfway
  // between two states that no one ever reads.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
}

/* Every view, in a real browser, so axe can measure colour contrast, which
   the jsdom suite cannot. */
for (const view of VIEWS) {
  test(`${view} has no axe violations`, async ({ page }) => {
    await open(page, view)
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations.map((v) => ({ id: v.id, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([])
  })
}

/* Tab through each view and require that whatever takes focus is actually on
   screen: a control that takes focus while hidden is invisible to a keyboard
   user, and no unit test sees it. */
for (const view of VIEWS) {
  test(`${view}: everything that takes focus is visible`, async ({ page }) => {
    await open(page, view)
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')
      if ((await focused.count()) === 0) continue
      await expect(focused).toBeVisible()
    }
  })
}

test('converts a preset and fills the output', async ({ page }) => {
  await open(page, 'Convert tokens')
  await page.getByLabel('Try a preset').selectOption({ index: 1 })
  const output = page.getByLabel(/ output$/)
  await expect(output).not.toHaveText('')
  await expect(output).toContainText(/\S/)
})
