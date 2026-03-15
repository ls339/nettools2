'use client'

import { useState } from 'react'
import styles from './styles.module.css'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'PTR']

export default function DnsLookup() {
    const [host, setHost] = useState('')
    const [recordType, setRecordType] = useState('A')
    const [result, setResult] = useState<{ records: string[] } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await fetch(`/api/dns/${encodeURIComponent(host)}?record_type=${recordType}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Lookup failed')
            }
            setResult(await res.json())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lookup failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.toolLayout}>
            <div className={styles.toolLeft}>
                <h2 className={styles.toolTitle}>DNS Lookup</h2>
                <p className={styles.toolSubtitle}>Query DNS records for a domain.</p>
                <form onSubmit={handleSubmit} className={styles.scanForm}>
                    <input
                        className={styles.scanInput}
                        type="text"
                        placeholder="Domain (e.g. example.com)"
                        value={host}
                        onChange={e => setHost(e.target.value)}
                        required
                    />
                    <select
                        className={styles.scanInput}
                        value={recordType}
                        onChange={e => setRecordType(e.target.value)}
                    >
                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className={styles.scanButton} type="submit" disabled={loading}>
                        {loading ? 'Looking up...' : 'Lookup'}
                    </button>
                </form>
            </div>

            <div className={styles.toolRight}>
                {error && <p className={styles.toolError}>{error}</p>}
                {result && (
                    <div className={styles.toolResult}>
                        {result.records.length === 0
                            ? <span className={styles.noPorts}>No records found</span>
                            : result.records.map((r, i) => (
                                <div key={i} className={styles.recordRow}>{r}</div>
                            ))
                        }
                    </div>
                )}
            </div>
        </div>
    )
}
