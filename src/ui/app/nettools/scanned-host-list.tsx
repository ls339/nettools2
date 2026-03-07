'use client'

import { useState } from 'react'
import styles from './styles.module.css'

type ScanResult = {
    id: string
    host: string
    range: [number, number]
    open_ports: number[]
}

export default function ScannedHostList({ initialResults }: { initialResults: ScanResult[] }) {
    const [results, setResults] = useState<ScanResult[]>(initialResults)

    async function handleDelete(taskId: string) {
        const res = await fetch(`/api/port/scanned/${taskId}`, { method: 'DELETE' })
        if (res.ok) {
            setResults(prev => prev.filter(r => r.id !== taskId))
        }
    }

    return (
        <div>
            {results.map(result => (
                <div key={result.id} className={styles.openports}>
                    <div>
                        <p>{result.host}</p>
                        <p>{result.range[0]} - {result.range[1]}</p>
                    </div>
                    <ul>
                        open
                        {result.open_ports.map(port => <li key={port}>{port}</li>)}
                    </ul>
                    <button className={styles.deleteButton} onClick={() => handleDelete(result.id)}>
                        Delete
                    </button>
                </div>
            ))}
        </div>
    )
}
