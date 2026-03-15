'use client'

import { useState } from 'react'
import styles from './styles.module.css'

type Hop = {
    hop: number
    host: string | null
    ip: string | null
    rtt_ms: number | null
}

export default function TracerouteTool() {
    const [host, setHost] = useState('')
    const [hops, setHops] = useState<Hop[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setHops(null)
        setError(null)
        try {
            const res = await fetch(`/api/traceroute/${encodeURIComponent(host)}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Traceroute failed')
            }
            const data = await res.json()
            setHops(data.hops)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Traceroute failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.toolLayout}>
            <div className={styles.toolLeft}>
                <h2 className={styles.toolTitle}>Traceroute</h2>
                <p className={styles.toolSubtitle}>Trace the network path to a host.</p>
                <form onSubmit={handleSubmit} className={styles.scanForm}>
                    <input
                        className={styles.scanInput}
                        type="text"
                        placeholder="Host or IP (e.g. 8.8.8.8)"
                        value={host}
                        onChange={e => setHost(e.target.value)}
                        required
                    />
                    <button className={styles.scanButton} type="submit" disabled={loading}>
                        {loading ? 'Tracing...' : 'Traceroute'}
                    </button>
                </form>
            </div>

            <div className={styles.toolRight}>
                {error && <p className={styles.toolError}>{error}</p>}
                {hops && (
                    <div className={styles.toolResult}>
                        {hops.length === 0
                            ? <span className={styles.noPorts}>No hops found</span>
                            : <table className={styles.hopTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Host</th>
                                        <th>IP</th>
                                        <th>RTT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hops.map(hop => (
                                        <tr key={hop.hop}>
                                            <td>{hop.hop}</td>
                                            <td>{hop.host ?? '*'}</td>
                                            <td>{hop.ip ?? '—'}</td>
                                            <td>{hop.rtt_ms !== null ? `${hop.rtt_ms} ms` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        }
                    </div>
                )}
            </div>
        </div>
    )
}
