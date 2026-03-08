'use client'

import { useEffect, useState } from 'react'
import styles from './styles.module.css'

type ScanResult = {
    id: string
    host: string
    range: [number, number]
    open_ports: number[]
}

async function fetchResults(): Promise<ScanResult[]> {
    const res = await fetch('/api/port/scanned/100')
    const data = await res.json()
    return data.results
}

export default function ScannedHostList() {
    const [results, setResults] = useState<ScanResult[]>([])

    useEffect(() => {
        fetchResults().then(setResults)
    }, [])

    async function handleRefresh() {
        fetchResults().then(setResults)
    }

    async function handleDelete(taskId: string) {
        const res = await fetch(`/api/port/scanned/${taskId}`, { method: 'DELETE' })
        if (res.ok) {
            setResults(prev => prev.filter(r => r.id !== taskId))
        }
    }

    return (
        <div>
        <button className={styles.refreshButton} onClick={handleRefresh}>Refresh</button>
        {results.length === 0 && <p className={styles.emptyState}>No scan results yet. Submit a scan above.</p>}
        <div className={styles.resultGrid}>
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
                            : result.open_ports.map(port => (
                                <span key={port} className={styles.portBadge}>{port}</span>
                            ))
                        }
                    </div>
                </div>
            ))}
        </div>
        </div>
    )
}
