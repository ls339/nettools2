'use client'

import { useState } from 'react'
import styles from './styles.module.css'

type SslResult = {
    host: string
    port: number
    verified: boolean
    common_name: string | null
    issuer: string | null
    not_before: string | null
    not_after: string | null
    sans: string[]
    cipher: string | null
    protocol: string | null
}

export default function SslInspector() {
    const [host, setHost] = useState('')
    const [port, setPort] = useState('443')
    const [result, setResult] = useState<SslResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await fetch(`/api/ssl/${encodeURIComponent(host)}?port=${port}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'SSL inspection failed')
            }
            setResult(await res.json())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'SSL inspection failed')
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
                    placeholder="Hostname (e.g. example.com)"
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    required
                />
                <input
                    className={styles.scanInput}
                    type="number"
                    placeholder="Port"
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    min={1}
                    max={65535}
                />
                <button className={styles.scanButton} type="submit" disabled={loading}>
                    {loading ? 'Inspecting...' : 'Inspect'}
                </button>
            </form>
            {error && <p className={styles.toolError}>{error}</p>}
            {result && (
                <div className={styles.toolResult}>
                    {!result.verified && (
                        <p className={styles.sslWarning}>⚠ Certificate not trusted — self-signed or unverified chain</p>
                    )}
                    <table className={styles.sslTable}>
                        <tbody>
                            <tr><td className={styles.sslLabel}>Common Name</td><td>{result.common_name ?? '—'}</td></tr>
                            <tr><td className={styles.sslLabel}>Issuer</td><td>{result.issuer ?? '—'}</td></tr>
                            <tr><td className={styles.sslLabel}>Valid From</td><td>{result.not_before ?? '—'}</td></tr>
                            <tr><td className={styles.sslLabel}>Valid Until</td><td>{result.not_after ?? '—'}</td></tr>
                            <tr><td className={styles.sslLabel}>Protocol</td><td>{result.protocol ?? '—'}</td></tr>
                            <tr><td className={styles.sslLabel}>Cipher</td><td>{result.cipher ?? '—'}</td></tr>
                            {result.sans.length > 0 && (
                                <tr>
                                    <td className={styles.sslLabel}>SANs</td>
                                    <td>
                                        <div className={styles.sansList}>
                                            {result.sans.map(san => (
                                                <span key={san} className={styles.portBadge}>{san}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
