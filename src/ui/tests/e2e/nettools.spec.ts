import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
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

// Flow 1: IP address appears in the navbar on every page load
test('displays the client IP address in the navbar', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByText('1.2.3.4')).toBeVisible()
})

// Flow 2: Port Scanner tab is active by default with all inputs
test('displays the port scanner form with all inputs by default', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByPlaceholder('Host (e.g. 192.168.1.1)')).toBeVisible()
    await expect(page.getByPlaceholder('Port start')).toBeVisible()
    await expect(page.getByPlaceholder('Port end')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeVisible()
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
    await page.getByRole('button', { name: 'Scan', exact: true }).click()

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
    await page.getByRole('button', { name: 'Scan', exact: true }).click()

    await expect(page.getByText('Error: could not submit scan request')).toBeVisible()
})

// Flow 5: Scan results are displayed in the port scanner tab
test('displays scan result cards with host, port range and open ports', async ({ page }) => {
    await page.goto('/nettools')
    await expect(page.getByText('localhost')).toBeVisible()
    await expect(page.getByText('Ports 80 – 82')).toBeVisible()
    await expect(page.getByText('80 HTTP')).toBeVisible()
    await expect(page.getByText('192.168.1.1')).toBeVisible()
    await expect(page.getByText('No open ports found')).toBeVisible()
})

// Flow 6: New scan results appear automatically via polling
test('new scan results appear automatically after submission', async ({ page }) => {
    let scanned = false
    await page.route('/api/port/scanned', route => {
        route.fulfill({ json: { id: 100, results: scanned ? [
            { id: 'task-abc', host: 'localhost', range: [80, 82], open_ports: [{ port: 80, service: 'HTTP' }] },
            { id: 'task-xyz', host: '10.0.0.1', range: [22, 22], open_ports: [{ port: 22, service: 'SSH' }] },
        ] : [
            { id: 'task-abc', host: 'localhost', range: [80, 82], open_ports: [{ port: 80, service: 'HTTP' }] },
        ] } })
    })
    await page.route('/api/portscan/*', route => {
        scanned = true
        route.fulfill({ json: { message: 'ok', id: 'task-xyz' } })
    })

    await page.goto('/nettools')
    await expect(page.getByText('localhost')).toBeVisible()
    await expect(page.getByText('10.0.0.1')).not.toBeVisible()

    await page.getByPlaceholder('Host (e.g. 192.168.1.1)').fill('10.0.0.1')
    await page.getByPlaceholder('Port start').fill('22')
    await page.getByPlaceholder('Port end').fill('22')
    await page.getByRole('button', { name: 'Scan', exact: true }).click()

    await expect(page.getByText('10.0.0.1')).toBeVisible({ timeout: 10000 })
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

// Flow 8: DNS lookup — navigate to tab, enter domain, see records
test('dns lookup displays records for a domain', async ({ page }) => {
    await page.route('/api/dns/*', route =>
        route.fulfill({ json: { host: 'example.com', record_type: 'A', records: ['93.184.216.34'] } })
    )

    await page.goto('/nettools')
    await page.getByRole('button', { name: 'DNS' }).click()
    await page.getByPlaceholder('Domain (e.g. example.com)').fill('example.com')
    await page.getByRole('button', { name: 'Lookup' }).click()

    await expect(page.getByText('93.184.216.34')).toBeVisible()
})

// Flow 9: DNS lookup shows error on failure
test('dns lookup shows error on failed request', async ({ page }) => {
    await page.route('/api/dns/*', route =>
        route.fulfill({ status: 404, json: { detail: 'Domain not found' } })
    )

    await page.goto('/nettools')
    await page.getByRole('button', { name: 'DNS' }).click()
    await page.getByPlaceholder('Domain (e.g. example.com)').fill('doesnotexist.invalid')
    await page.getByRole('button', { name: 'Lookup' }).click()

    await expect(page.getByText('Domain not found')).toBeVisible()
})

// Flow 10: Ping tab — displays packet stats and RTT
test('ping displays packet stats and rtt', async ({ page }) => {
    await page.route('/api/ping/*', route =>
        route.fulfill({
            json: {
                host: '8.8.8.8',
                packets_sent: 4,
                packets_received: 4,
                packet_loss_pct: 0,
                rtt_min: 1.1,
                rtt_avg: 2.2,
                rtt_max: 3.3,
            },
        })
    )

    await page.goto('/nettools')
    await page.getByRole('button', { name: 'Ping' }).click()
    await page.getByPlaceholder('Host or IP (e.g. 8.8.8.8)').fill('8.8.8.8')
    await page.getByRole('button', { name: 'Ping' }).last().click()

    await expect(page.getByText('0%')).toBeVisible()
    await expect(page.getByText('2.2 ms')).toBeVisible()
})

// Flow 11: Traceroute tab — displays hop table
test('traceroute displays hop rows', async ({ page }) => {
    await page.route('/api/traceroute/*', route =>
        route.fulfill({
            json: {
                host: '8.8.8.8',
                hops: [
                    { hop: 1, host: 'gateway', ip: '192.168.1.1', rtt_ms: 1.2 },
                    { hop: 2, host: null, ip: null, rtt_ms: null },
                ],
            },
        })
    )

    await page.goto('/nettools')
    await page.getByRole('button', { name: 'Traceroute' }).click()
    await page.getByPlaceholder('Host or IP (e.g. 8.8.8.8)').fill('8.8.8.8')
    await page.getByRole('button', { name: 'Traceroute' }).last().click()

    await expect(page.getByText('192.168.1.1')).toBeVisible()
    await expect(page.getByText('1.2 ms')).toBeVisible()
})

// Flow 12: SSL tab — displays certificate details
test('ssl inspector displays cert info', async ({ page }) => {
    await page.route('/api/ssl/*', route =>
        route.fulfill({
            json: {
                host: 'example.com',
                port: 443,
                verified: true,
                common_name: 'example.com',
                issuer: "Let's Encrypt",
                not_before: 'Jan  1 00:00:00 2025 GMT',
                not_after: 'Apr  1 00:00:00 2025 GMT',
                sans: ['example.com', 'www.example.com'],
                cipher: 'TLS_AES_256_GCM_SHA384',
                protocol: 'TLSv1.3',
            },
        })
    )

    await page.goto('/nettools')
    await page.getByRole('button', { name: 'SSL / TLS' }).click()
    await page.getByPlaceholder('Hostname (e.g. example.com)').fill('example.com')
    await page.getByRole('button', { name: 'Inspect' }).click()

    await expect(page.getByText('example.com').first()).toBeVisible()
    await expect(page.getByText("Let's Encrypt")).toBeVisible()
    await expect(page.getByText('TLSv1.3')).toBeVisible()
})
