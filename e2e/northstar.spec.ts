import { test, expect, type Page } from '@playwright/test'

const OBJECTIVE_DAILY = "Make Northstar the team's daily driver"

async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: /Try the demo workspace/ }).click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now().toString().slice(-6)}`
}

// The board defaults its assignee filter to "Me"; reset to everyone.
async function showAllAssignees(page: Page) {
  await page.getByLabel('Filter by assignee').selectOption('')
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

  const card = page.locator('div.card').filter({ hasText: objTitle }).first()
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
  await showAllAssignees(page) // the new story is unassigned

  const storyTitle = uniq('E2E story')
  await page.getByTitle('New story in Backlog').click()
  await page.getByLabel('Story title').fill(storyTitle)
  await page.getByRole('button', { name: 'Create story', exact: true }).click()

  const inBacklog = page.getByTestId('column-backlog').locator(`[data-story-title="${storyTitle}"]`)
  await expect(inBacklog).toBeVisible()

  // Open the card (detail drawer) and move it to "In progress" — inline, no save button.
  await inBacklog.click()
  await page.getByLabel('Story status').selectOption({ label: 'In progress' })
  await page.keyboard.press('Escape') // close the drawer

  await expect(page.getByTestId('column-in-progress').locator(`[data-story-title="${storyTitle}"]`)).toBeVisible()
  await expect(page.getByTestId('column-backlog').locator(`[data-story-title="${storyTitle}"]`)).toHaveCount(0)
})

// ---------------- v1.1 ----------------

test('opens a story, comments, and logs activity on status change', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Board', exact: true }).click()

  await page.locator('[data-story-title="Postmortem template & on-call rota"]').click()

  const note = uniq('e2e comment')
  await page.getByLabel('Add a comment').fill(note)
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByTestId('timeline').getByText(note)).toBeVisible()

  // Changing a property writes an activity entry (server-side trigger).
  await page.getByLabel('Story status').selectOption({ label: 'In review' })
  await expect(page.getByTestId('timeline').getByText(/moved/)).toBeVisible()
})

test('key result detail shows the leading indicator and contributing work', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()

  await page.getByRole('button', { name: /Activation rate/ }).click()
  await expect(page.getByTestId('kr-leading')).toBeVisible()
  await expect(page.getByText(/Contributing work \(\d+\)/)).toBeVisible()
})

test('command palette searches and navigates', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /Search/ }).click()

  await page.getByLabel('Command menu').fill('Sentry')
  // Clicking the result auto-waits for the stories query to populate it.
  await page.getByRole('button', { name: /Add Sentry error tracking/ }).click()

  // Story results deep-link straight to the card.
  await expect(page).toHaveURL(/\/board\?story=/)
  await expect(page.getByLabel('Story title')).toHaveValue('Add Sentry error tracking')
})

// ---------------- v1.2 ----------------

test('posts a key-result check-in and records the history', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()

  await page.getByRole('button', { name: /Team NPS/ }).click() // open KR detail
  await page.getByLabel('Check-in value').fill('44')
  const note = uniq('e2e check-in')
  await page.getByLabel('Check-in note').fill(note)
  await page.getByRole('button', { name: 'Post check-in', exact: true }).click()

  await expect(page.getByTestId('checkin-history').getByText(note)).toBeVisible()
  // Team NPS: 30 → 50, so a value of 44 is 70%.
  await expect(page.getByTestId('kr-lagging')).toHaveText('70%')
})

test('opens an objective rollup with leading indicator and serving epics', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()

  await page.getByRole('button', { name: /Make Northstar the team/ }).click()
  await expect(page.getByTestId('objective-leading')).toBeVisible()
  await expect(page.getByText(/Epics serving this objective \(\d+\)/)).toBeVisible()
  await expect(page.getByText('Onboarding & activation flow')).toBeVisible()
})

test('My Work lists the stories assigned to me', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'My Work', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'My Work' })).toBeVisible()
  await expect(page.getByText('Postmortem template & on-call rota')).toBeVisible()
  await expect(page.getByText('Clean up unused feature flags')).toBeVisible()
})

// ---------------- v1.3 ----------------

test('invites a teammate via a one-time link they can accept', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Team', exact: true }).click()

  const emailAddr = `e2e-invite-${Date.now().toString().slice(-7)}@northstar.app`
  await page.getByLabel('Invite email').fill(emailAddr)
  await page.getByLabel('Invite name').fill('E2E Invitee')
  await page.getByRole('button', { name: 'Create invite link', exact: true }).click()

  await expect(page.getByTestId('invite-result')).toBeVisible()
  const link = await page.getByTestId('invite-link').inputValue()
  expect(link).toContain('/accept-invite?token=')

  // Accept the invite → set a password → land signed in as the new member.
  await page.goto(link)
  await page.getByLabel('Password', { exact: true }).fill('invitee-pass-123')
  await page.getByLabel('Confirm password').fill('invitee-pass-123')
  await page.getByRole('button', { name: /Set password & sign in/ }).click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
})

test('a story opens from a shareable deep link', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Board', exact: true }).click()
  await showAllAssignees(page) // "Add Sentry" is assigned to Leo, not the demo user

  // Discover the NS ref by opening the card, then reload via its deep link.
  await page.locator('[data-story-title="Add Sentry error tracking"]').click()
  const ref = (await page.getByRole('dialog').getByText(/^NS-\d+$/).first().innerText()).trim()
  await page.keyboard.press('Escape')

  await page.goto(`/board?story=${ref}`)
  await expect(page.getByLabel('Story title')).toHaveValue('Add Sentry error tracking')
})

test('OKR list shows a check-in trend sparkline', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'OKRs', exact: true }).click()
  // Seeded KRs (e.g. Activation rate) have multiple check-ins → a sparkline renders.
  await expect(page.getByTestId('kr-sparkline').first()).toBeVisible()
})

test('lists unaligned in-flight work on the dashboard', async ({ page }) => {
  await login(page)
  // The unaligned section reflects active stories with no objective behind them.
  const section = page.getByText(/Unaligned work in flight \(\d+\)/)
  await expect(section).toBeVisible()
  await expect(page.getByTestId('alignment-pct')).toHaveText(/%$/)
})

test('board can switch to a list view of tasks', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Board', exact: true }).click()
  await showAllAssignees(page)
  await page.getByTestId('view-list').click()
  await expect(page.getByTestId('task-row').first()).toBeVisible()
  await expect(page.getByText('Add Sentry error tracking')).toBeVisible()
})

test('board assignee filter defaults to Me and clears to all', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Board', exact: true }).click()

  // Default = Me (demo): demo's task shows, Leo's does not.
  await expect(page.getByText('Postmortem template & on-call rota')).toBeVisible()
  await expect(page.getByText('Add Sentry error tracking')).toHaveCount(0)

  // Clearing the filter reveals everyone's tasks.
  await page.getByRole('button', { name: 'Clear assignee filter' }).click()
  await expect(page.getByText('Add Sentry error tracking')).toBeVisible()

  // "Unassigned" shows only tasks with no assignee, so an assigned task is hidden.
  await page.getByLabel('Filter by assignee').selectOption({ label: 'Unassigned' })
  await expect(page.getByText('Postmortem template & on-call rota')).toHaveCount(0)
})

// Runs LAST: imports the full Airtable base into the (separate) mamamia workspace.
// Uses creds from the environment so the token is never committed; skips if absent.
const AT_TOKEN = process.env.AIRTABLE_TOKEN
const AT_BASE = process.env.AIRTABLE_BASE_ID
test('connects Airtable server-side and syncs into the workspace', async ({ page }) => {
  test.skip(!AT_TOKEN || !AT_BASE, 'Airtable creds not in env')
  test.setTimeout(120_000) // a real sync (~1220 rows) + loading the board needs headroom
  await loginAs(page, 'mamamia@northstar.app', 'mamamia2026')
  await page.getByRole('link', { name: 'Integrations', exact: true }).click()

  // Make the run deterministic regardless of stored state: start disconnected.
  await expect(page.getByRole('heading', { name: 'Airtable' })).toBeVisible()
  await page.waitForTimeout(800) // let the workspace status resolve
  const disconnectBtn = page.getByRole('button', { name: 'Disconnect' })
  if (await disconnectBtn.count()) await disconnectBtn.click()

  // Not connected → connect form. The token is stored once for the workspace.
  await page.getByLabel('Airtable token').fill(AT_TOKEN!)
  await page.getByLabel('Airtable base id').fill(AT_BASE!)
  await page.getByRole('button', { name: 'Connect & sync from Airtable', exact: true }).click()
  await expect(page.getByTestId('sync-result')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('sync-result')).toContainText(/people/)

  // The token is now stored server-side for the whole workspace; "Sync now"
  // would reuse it (verified separately) — kept light here to avoid two
  // back-to-back 1220-row syncs.
  await expect(page.getByTestId('integration-connected')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeVisible()

  // The imported tasks render (guards the 1000-row cap / payload regression).
  // Reload for a clean fetch of the freshly-synced data; admin owns nothing so
  // switch the filter off "Me".
  await page.reload()
  await page.getByRole('link', { name: 'Board', exact: true }).click()
  await showAllAssignees(page)
  await expect(page.getByTestId('story-card').first()).toBeVisible({ timeout: 45_000 })
})
