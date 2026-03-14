import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    // Mock API responses before each test
    await page.route('/api/myip', route =>
        route.fulfill({ json: { client_host: '1.2.3.4' } })
    )
    await page.route('/api/port/scanned', route =>
        route.fulfill({
            json: {
                id: 100,
                results: [
                    { id: 'task-abc', host: 'localhost', range: [80, 82], open_ports: [{ port: 80, service: 'HTTP' }] },
                    { id: 'task-def', host: '192.168.1.1', range: [443, 443], open_ports: [] },
                ],
            },
        })
    )
})

// Flow 1: Page loads and displays IP address
test('displays the client IP address on load', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByText('1.2.3.4')).toBeVisible()
})

// Flow 2: Scan form is labelled and present
test('displays the port scanner form with all inputs', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByPlaceholder('Host (e.g. 192.168.1.1)')).toBeVisible()
    await expect(page.getByPlaceholder('Port start')).toBeVisible()
    await expect(page.getByPlaceholder('Port end')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible()
})

// Flow 3: User submits the scan form and sees confirmation
test('shows task ID after successful scan submission', async ({ page }) => {
    await page.route('/api/portscan/*', route =>
        route.fulfill({ json: { message: 'ok', id: 'new-task-123' } })
    )

    await page.goto('/nettools')
    await page.getByPlaceholder('Host (e.g. 192.168.1.1)').fill('localhost')
    await page.getByPlaceholder('Port start').fill('80')
    await page.getByPlaceholder('Port end').fill('90')
    await page.getByRole('button', { name: 'Scan' }).click()

    await expect(page.getByText('Scan queued — task ID: new-task-123')).toBeVisible()
})

// Flow 4: User submits scan form and API returns an error
test('shows error message when scan submission fails', async ({ page }) => {
    await page.route('/api/portscan/*', route =>
        route.fulfill({ status: 500 })
    )

    await page.goto('/nettools')
    await page.getByPlaceholder('Host (e.g. 192.168.1.1)').fill('localhost')
    await page.getByPlaceholder('Port start').fill('80')
    await page.getByPlaceholder('Port end').fill('90')
    await page.getByRole('button', { name: 'Scan' }).click()

    await expect(page.getByText('Error: could not submit scan request')).toBeVisible()
})

// Flow 5: Scan results are displayed correctly
test('displays scan result cards with host, port range and open ports', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByText('localhost')).toBeVisible()
    await expect(page.getByText('Ports 80 – 82')).toBeVisible()
    await expect(page.getByText('80 HTTP')).toBeVisible()
    await expect(page.getByText('192.168.1.1')).toBeVisible()
    await expect(page.getByText('No open ports found')).toBeVisible()
})

// Flow 6: Refresh button reloads scan results
test('refresh button fetches and displays updated results', async ({ page }) => {
    let callCount = 0
    await page.route('/api/port/scanned', route => {
        callCount++
        if (callCount === 1) {
            route.fulfill({ json: { id: 100, results: [
                { id: 'task-abc', host: 'localhost', range: [80, 82], open_ports: [{ port: 80, service: 'HTTP' }] },
            ] } })
        } else {
            route.fulfill({ json: { id: 100, results: [
                { id: 'task-abc', host: 'localhost', range: [80, 82], open_ports: [{ port: 80, service: 'HTTP' }] },
                { id: 'task-xyz', host: '10.0.0.1', range: [22, 22], open_ports: [{ port: 22, service: 'SSH' }] },
            ] } })
        }
    })

    await page.goto('/nettools')
    await expect(page.getByText('localhost')).toBeVisible()
    await expect(page.getByText('10.0.0.1')).not.toBeVisible()

    await page.getByRole('button', { name: 'Refresh' }).click()

    await expect(page.getByText('10.0.0.1')).toBeVisible()
})

// Flow 7: User deletes a scan result
test('removes a result card after clicking Delete', async ({ page }) => {
    await page.route('/api/port/scanned/task-abc', route =>
        route.fulfill({ json: { message: 'deleted' } })
    )

    await page.goto('/nettools')
    await expect(page.getByText('localhost')).toBeVisible()

    const card = page.locator('[class*="resultCard"]').filter({ hasText: 'localhost' })
    await card.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('localhost')).not.toBeVisible()
    await expect(page.getByText('192.168.1.1')).toBeVisible()
})
