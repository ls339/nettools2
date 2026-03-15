'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './styles.module.css'

type PortEntry = { port: number; service: string | null }
type ScanResult = { id: string; host: string; range: [number, number]; open_ports: PortEntry[] }

async function fetchResults(): Promise<ScanResult[]> {
    const res = await fetch('/api/port/scanned')
    const data = await res.json()
    return data.results
}

export default function PortScanner() {
    const [host, setHost] = useState('')
    const [portStart, setPortStart] = useState('')
    const [portEnd, setPortEnd] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<ScanResult[]>([])
    const [polling, setPolling] = useState(false)
    const pendingIds = useRef<Set<string>>(new Set())
    const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        fetchResults().then(setResults)
        return () => { if (pollTimer.current) clearTimeout(pollTimer.current) }
    }, [])

    function schedulePoll() {
        pollTimer.current = setTimeout(async () => {
            const latest = await fetchResults()
            setResults(latest)
            const latestIds = new Set(latest.map(r => r.id))
            for (const id of pendingIds.current) {
                if (latestIds.has(id)) pendingIds.current.delete(id)
            }
            if (pendingIds.current.size > 0) {
                schedulePoll()
            } else {
                setPolling(false)
            }
        }, 2000)
    }

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
            pendingIds.current.add(data.id)
            setPolling(true)
            schedulePoll()
        } catch {
            setStatus('Error: could not submit scan request')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(taskId: string) {
        const res = await fetch(`/api/port/scanned/${taskId}`, { method: 'DELETE' })
        if (res.ok) setResults(prev => prev.filter(r => r.id !== taskId))
    }

    return (
        <div className={styles.toolLayout}>
            <div className={styles.toolLeft}>
                <h2 className={styles.toolTitle}>Port Scanner</h2>
                <p className={styles.toolSubtitle}>Queue a TCP scan against a host and port range.</p>
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
            </div>

            <div className={styles.toolRight}>
                <div className={styles.resultsHeader}>
                    <h3 className={styles.resultsTitle}>
                        Scan Results
                        {polling && <span className={styles.pollingIndicator}>waiting for results…</span>}
                    </h3>
                </div>
                {results.length === 0
                    ? <p className={styles.emptyState}>No scan results yet. Submit a scan to get started.</p>
                    : <div className={styles.resultGrid}>
                        {results.map(result => (
                            <div key={result.id} className={styles.resultCard}>
                                <div className={styles.resultCardHeader}>
                                    <span className={styles.resultHost}>{result.host}</span>
                                    <button className={styles.deleteButton} onClick={() => handleDelete(result.id)}>
                                        Delete
                                    </button>
                                </div>
                                <p className={styles.resultRange}>Ports {result.range[0]} – {result.range[1]}</p>
                                <div className={styles.resultPorts}>
                                    {result.open_ports.length === 0
                                        ? <span className={styles.noPorts}>No open ports found</span>
                                        : result.open_ports.map(({ port, service }) => (
                                            <span key={port} className={styles.portBadge}>
                                                {port}{service ? ` ${service}` : ''}
                                            </span>
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                }
            </div>
        </div>
    )
}
