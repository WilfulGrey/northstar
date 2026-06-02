import { test, expect, type Page } from '@playwright/test'

const OBJECTIVE_DAILY = "Make Northstar the team's daily driver"

async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /Try the demo workspace/ }).click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now().toString().slice(-6)}`
}

test('signs in and shows the alignment dashboard with seeded data', async ({ page }) => {
  await login(page)

  // Headline alignment metric is rendered as a percentage.
  await expect(page.getByTestId('alignment-pct')).toHaveText(/%$/)

  // Seeded objective shows up in the objectives overview.
  await expect(page.getByText(OBJECTIVE_DAILY)).toBeVisible()

  // The differentiator: unaligned in-flight work is surfaced.
  await expect(page.getByText(/Unaligned work in flight/)).toBeVisible()
})

test('updating a key result value recomputes its progress', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()

  // Team NPS: start 30, target 50 → setting current to 50 means 100%.
  const row = page.locator('[data-kr-title="Team NPS"]')
  await expect(row).toBeVisible()
  await row.getByTestId('kr-current').fill('50')
  await row.getByTestId('kr-current').press('Enter')

  await expect(row.getByText('100%')).toBeVisible()
})

test('creates an objective and adds a key result to it', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()

  const objTitle = uniq('E2E objective')
  await page.getByRole('button', { name: '+ New objective' }).click()
  await page.getByLabel('Objective title').fill(objTitle)
  await page.getByRole('button', { name: 'Create objective', exact: true }).click()

  const card = page.locator('div.card').filter({ has: page.getByRole('heading', { name: objTitle }) }).first()
  await expect(card).toBeVisible()

  const krTitle = uniq('E2E key result')
  await card.getByRole('button', { name: '+ Add key result' }).click()
  await page.getByLabel('Key result title').fill(krTitle)
  await page.getByRole('button', { name: 'Add key result', exact: true }).click()

  await expect(card.getByText(krTitle)).toBeVisible()
})

test('creates an epic linked to an objective (alignment bridge)', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Epics', exact: true }).click()

  const epicTitle = uniq('E2E epic')
  await page.getByRole('button', { name: '+ New epic' }).click()
  await page.getByLabel('Epic title').fill(epicTitle)
  await page.getByLabel('Linked objective').selectOption({ label: OBJECTIVE_DAILY })
  await page.getByRole('button', { name: 'Create epic', exact: true }).click()

  const card = page.locator('div.card').filter({ hasText: epicTitle }).first()
  await expect(card).toBeVisible()
  // It should show the linked objective, not the "Unaligned" warning.
  await expect(card.getByText(/Make Northstar/)).toBeVisible()
  await expect(card.getByText('Unaligned')).toHaveCount(0)
})

test('creates a story and moves it across the board', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Board', exact: true }).click()

  const storyTitle = uniq('E2E story')
  await page.getByTitle('New story in Backlog').click()
  await page.getByLabel('Story title').fill(storyTitle)
  await page.getByRole('button', { name: 'Create story', exact: true }).click()

  const inBacklog = page.getByTestId('column-backlog').locator(`[data-story-title="${storyTitle}"]`)
  await expect(inBacklog).toBeVisible()

  // Open the card and move it to "In progress".
  await inBacklog.click()
  await page.getByLabel('Story status').selectOption({ label: 'In progress' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByTestId('column-in_progress').locator(`[data-story-title="${storyTitle}"]`)).toBeVisible()
  await expect(page.getByTestId('column-backlog').locator(`[data-story-title="${storyTitle}"]`)).toHaveCount(0)
})

test('lists unaligned in-flight work on the dashboard', async ({ page }) => {
  await login(page)
  // The unaligned section reflects active stories with no objective behind them.
  const section = page.getByText(/Unaligned work in flight \(\d+\)/)
  await expect(section).toBeVisible()
  await expect(page.getByTestId('alignment-pct')).toHaveText(/%$/)
})
