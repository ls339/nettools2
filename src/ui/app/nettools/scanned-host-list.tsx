'use client'

import { useEffect, useState } from 'react'
import styles from './styles.module.css'

type ScanResult = {
    id: string
    host: string
    range: [number, number]
    open_ports: number[]
}

export default function ScannedHostList() {
    const [results, setResults] = useState<ScanResult[]>([])

    useEffect(() => {
        fetch('/api/port/scanned/100')
            .then(res => res.json())
            .then(data => setResults(data.results))
    }, [])

    async function handleDelete(taskId: string) {
        const res = await fetch(`/api/port/scanned/${taskId}`, { method: 'DELETE' })
        if (res.ok) {
            setResults(prev => prev.filter(r => r.id !== taskId))
        }
    }

    if (results.length === 0) {
        return <p className={styles.emptyState}>No scan results yet. Submit a scan above.</p>
    }

    return (
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
    )
}
