'use client'

import { useState } from 'react'
import styles from './styles.module.css'

type PingResult = {
    host: string
    packets_sent: number
    packets_received: number
    packet_loss_pct: number
    rtt_min: number | null
    rtt_avg: number | null
    rtt_max: number | null
}

export default function PingTool() {
    const [host, setHost] = useState('')
    const [result, setResult] = useState<PingResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await fetch(`/api/ping/${encodeURIComponent(host)}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Ping failed')
            }
            setResult(await res.json())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ping failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.toolForm}>
                <input
                    className={styles.scanInput}
                    type="text"
                    placeholder="Host or IP (e.g. 8.8.8.8)"
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    required
                />
                <button className={styles.scanButton} type="submit" disabled={loading}>
                    {loading ? 'Pinging...' : 'Ping'}
                </button>
            </form>
            {error && <p className={styles.toolError}>{error}</p>}
            {result && (
                <div className={styles.toolResult}>
                    <div className={styles.pingStats}>
                        <div className={styles.pingStat}>
                            <span className={styles.pingStatLabel}>Sent</span>
                            <span className={styles.pingStatValue}>{result.packets_sent}</span>
                        </div>
                        <div className={styles.pingStat}>
                            <span className={styles.pingStatLabel}>Received</span>
                            <span className={styles.pingStatValue}>{result.packets_received}</span>
                        </div>
                        <div className={styles.pingStat}>
                            <span className={styles.pingStatLabel}>Loss</span>
                            <span className={styles.pingStatValue}>{result.packet_loss_pct}%</span>
                        </div>
                        {result.rtt_avg !== null && <>
                            <div className={styles.pingStat}>
                                <span className={styles.pingStatLabel}>Min</span>
                                <span className={styles.pingStatValue}>{result.rtt_min} ms</span>
                            </div>
                            <div className={styles.pingStat}>
                                <span className={styles.pingStatLabel}>Avg</span>
                                <span className={styles.pingStatValue}>{result.rtt_avg} ms</span>
                            </div>
                            <div className={styles.pingStat}>
                                <span className={styles.pingStatLabel}>Max</span>
                                <span className={styles.pingStatValue}>{result.rtt_max} ms</span>
                            </div>
                        </>}
                    </div>
                </div>
            )}
        </div>
    )
}
