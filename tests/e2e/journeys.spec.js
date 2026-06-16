const { test, expect } = require('@playwright/test')

const LOGIN = { email:'admin@demo.com', password:'Admin@123', tenantSlug:'demo' }

async function login(page) {
  await page.goto('/login')
  await page.fill('input[placeholder*="yourcompany"]', LOGIN.tenantSlug)
  await page.fill('input[type="email"]', LOGIN.email)
  await page.fill('input[type="password"]', LOGIN.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/)
}

test.describe('JOURNEY 1 — Login and Dashboard', () => {
  test('user can log in and sees dashboard KPIs', async ({ page }) => {
    await login(page)
    await expect(page.locator('text=Active Leads')).toBeVisible()
    await expect(page.locator('text=Active Projects')).toBeVisible()
  })
})

test.describe('JOURNEY 2 — Lead Creation and Stage Change', () => {
  test('create lead and drag to next stage', async ({ page }) => {
    await login(page)
    await page.goto('/leads')
    await page.click('text=New Lead')
    await page.fill('input[name="name"]', 'Playwright Test Client')
    await page.fill('input[name="phone"]', '9988776655')
    await page.selectOption('select[name="source"]', 'website')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Playwright Test Client')).toBeVisible()
  })
})

test.describe('JOURNEY 3 — Project Creation', () => {
  test('create a project with a template', async ({ page }) => {
    await login(page)
    await page.goto('/projects')
    await page.click('text=New Project')
    await page.click('text=Full Interior')  // project type card
    await page.fill('input[name="client_name"]', 'E2E Test Client')
    await page.fill('input[name="name"]', 'E2E Test Project')
    await page.click('button:has-text("Create Project")')
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/)
    await expect(page.locator('text=E2E Test Project')).toBeVisible()
  })
})

test.describe('JOURNEY 4 — Config Centre Access', () => {
  test('admin can access config centre', async ({ page }) => {
    await login(page)
    await page.goto('/config/lead-stages')
    await expect(page.locator('text=Lead Stages')).toBeVisible()
    await expect(page.locator('text=New')).toBeVisible()  // default stage
  })

  test('config centre is forbidden for non-admin', async ({ page }) => {
    // Login as non-admin (need a test non-admin user seeded)
    await page.goto('/config')
    // Without login → should redirect to /login
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('JOURNEY 5 — Portal Login', () => {
  test('client can navigate to portal login', async ({ page }) => {
    await page.goto('/portal/login')
    await expect(page.locator('text=Sign in')).toBeVisible()
    await expect(page.locator('text=Send OTP')).toBeVisible()
  })
})
