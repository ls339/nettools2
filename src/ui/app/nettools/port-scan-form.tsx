'use client'

import { useState } from 'react'
import styles from './styles.module.css'

export default function PortScanForm() {
    const [host, setHost] = useState('')
    const [portStart, setPortStart] = useState('')
    const [portEnd, setPortEnd] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setStatus(null)

        try {
            const res = await fetch(
                `/api/portscan/${encodeURIComponent(host)}?port_start=${portStart}&port_end=${portEnd}`,
                { method: 'POST' }
            )
            if (!res.ok) throw new Error('Scan request failed')
            const data = await res.json()
            setStatus(`Scan queued — task ID: ${data.id}`)
        } catch {
            setStatus('Error: could not submit scan request')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.scanForm}>
            <input
                className={styles.scanInput}
                type="text"
                placeholder="Host (e.g. 192.168.1.1)"
                value={host}
                onChange={e => setHost(e.target.value)}
                required
            />
            <input
                className={styles.scanInput}
                type="number"
                placeholder="Port start"
                value={portStart}
                onChange={e => setPortStart(e.target.value)}
                min={1}
                max={65535}
                required
            />
            <input
                className={styles.scanInput}
                type="number"
                placeholder="Port end"
                value={portEnd}
                onChange={e => setPortEnd(e.target.value)}
                min={1}
                max={65535}
                required
            />
            <button className={styles.scanButton} type="submit" disabled={loading}>
                {loading ? 'Scanning...' : 'Scan'}
            </button>
            {status && <p className={styles.scanStatus}>{status}</p>}
        </form>
    )
}
