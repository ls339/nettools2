import { test, expect } from '@playwright/test'

// Helper: mock a valid NextAuth session
function mockSession(page, user = { name: 'testuser', email: 'test@test.com' }) {
    return page.route('/api/auth/session', route =>
        route.fulfill({
            json: {
                user,
                expires: new Date(Date.now() + 86400000).toISOString(),
            },
        })
    )
}

// Flow 1: Unauthenticated user is redirected to sign-in
test('redirects unauthenticated user to sign-in page', async ({ page }) => {
    await page.route('/api/auth/session', route =>
        route.fulfill({ json: {} })
    )

    await page.goto('/nettools')

    await expect(page).toHaveURL(/\/api\/auth\/signin|\/login/)
})

// Flow 2: Sign-in page has the expected form elements
test('sign-in page renders username and password fields', async ({ page }) => {
    await page.goto('/api/auth/signin')

    await expect(page.getByLabel(/username|email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})

// Flow 3: Successful login redirects to /nettools
test('successful login redirects to nettools page', async ({ page }) => {
    // Mock API responses the nettools page will call after login
    await page.route('/api/myip', route =>
        route.fulfill({ json: { client_host: '1.2.3.4' } })
    )
    await page.route('/api/port/scanned', route =>
        route.fulfill({ json: { id: 100, results: [] } })
    )

    await page.goto('/api/auth/signin?callbackUrl=%2Fnettools')

    await page.getByLabel(/username/i).fill('admin')
    await page.getByLabel(/password/i).fill('admin')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/nettools/)
    await expect(page.getByText('1.2.3.4')).toBeVisible()
})

// Flow 4: Failed login shows error
test('failed login shows error message', async ({ page }) => {
    await page.goto('/api/auth/signin')

    await page.getByLabel(/username|email/i).fill('wrong')
    await page.getByLabel(/password/i).fill('wrong')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/sign in failed/i)).toBeVisible()
})

// Flow 5: Sign-out button logs user out
test('sign-out button redirects to sign-in page', async ({ page }) => {
    await page.route('/api/myip', route =>
        route.fulfill({ json: { client_host: '1.2.3.4' } })
    )
    await page.route('/api/port/scanned', route =>
        route.fulfill({ json: { id: 100, results: [] } })
    )

    // Log in first
    await page.goto('/api/auth/signin?callbackUrl=%2Fnettools')
    await page.getByLabel(/username/i).fill('admin')
    await page.getByLabel(/password/i).fill('admin')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/nettools/)

    // Now sign out
    await page.getByRole('button', { name: /sign out/i }).click()

    await expect(page).toHaveURL(/\/api\/auth\/signin|\/login/)
})

// Flow 6: Navbar shows logged-in user identity
test('navbar displays user name when logged in', async ({ page }) => {
    await mockSession(page, { name: 'Test User', email: 'test@test.com' })
    await page.route('/api/myip', route =>
        route.fulfill({ json: { client_host: '1.2.3.4' } })
    )
    await page.route('/api/port/scanned', route =>
        route.fulfill({ json: { id: 100, results: [] } })
    )

    await page.goto('/nettools')

    await expect(page.getByText('Test User')).toBeVisible()
})
