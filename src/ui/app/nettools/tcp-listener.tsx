'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './styles.module.css'

type Connection = {
    connected_at: string
    client_ip: string
    client_port: number
    data: string
}

type ListenerState = {
    id: string
    port: number
    timeout: number
    started_at: string
    status: 'listening' | 'stopped' | 'expired' | 'error'
    connections: Connection[]
}

export default function TcpListener() {
    const [port, setPort] = useState('7100')
    const [timeout, setTimeoutVal] = useState('120')
    const [listener, setListener] = useState<ListenerState | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    function stopPolling() {
        if (pollTimer.current) {
            clearInterval(pollTimer.current)
            pollTimer.current = null
        }
    }

    useEffect(() => () => stopPolling(), [])

    async function pollListener(id: string) {
        try {
            const res = await fetch(`/api/listener/${id}`)
            if (!res.ok) return
            const data: ListenerState = await res.json()
            setListener(data)
            if (data.status !== 'listening') stopPolling()
        } catch { /* ignore poll errors */ }
    }

    async function handleStart(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/listener/start?port=${port}&timeout=${timeout}`,
                { method: 'POST' }
            )
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Failed to start listener')
            }
            const data: ListenerState = await res.json()
            setListener({ ...data, connections: [] })
            pollTimer.current = setInterval(() => pollListener(data.id), 2000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start listener')
        } finally {
            setLoading(false)
        }
    }

    async function handleStop() {
        if (!listener) return
        stopPolling()
        try {
            await fetch(`/api/listener/${listener.id}`, { method: 'DELETE' })
        } catch { /* ignore */ }
        setListener(prev => prev ? { ...prev, status: 'stopped' } : null)
    }

    const isListening = listener?.status === 'listening'

    return (
        <div className={styles.toolLayout}>
            <div className={styles.toolLeft}>
                <h2 className={styles.toolTitle}>TCP Listener</h2>
                <p className={styles.toolSubtitle}>
                    Start a TCP listener on a port. Incoming connections and their data are captured in real time.
                </p>
                <form onSubmit={handleStart} className={styles.scanForm}>
                    <input
                        className={styles.scanInput}
                        type="number"
                        placeholder="Port (7100–7109)"
                        value={port}
                        onChange={e => setPort(e.target.value)}
                        min={7100}
                        max={7109}
                        required
                        disabled={isListening}
                    />
                    <input
                        className={styles.scanInput}
                        type="number"
                        placeholder="Timeout (seconds, max 300)"
                        value={timeout}
                        onChange={e => setTimeoutVal(e.target.value)}
                        min={1}
                        max={300}
                        disabled={isListening}
                    />
                    <button className={styles.scanButton} type="submit" disabled={loading || isListening}>
                        {loading ? 'Starting...' : 'Start Listener'}
                    </button>
                    {isListening && (
                        <button type="button" className={styles.stopButton} onClick={handleStop}>
                            Stop Listener
                        </button>
                    )}
                </form>
                {error && <p className={styles.toolError}>{error}</p>}
                {isListening && (
                    <p className={styles.listenerHint}>
                        Connect to: <code className={styles.listenerAddr}>localhost:{listener!.port}</code>
                    </p>
                )}
            </div>

            <div className={styles.toolRight}>
                {!listener && (
                    <p className={styles.emptyState}>Start a listener to capture incoming TCP connections.</p>
                )}
                {listener && (
                    <>
                        <div className={styles.listenerStatusBar}>
                            <span className={isListening ? styles.statusListening : styles.statusStopped}>
                                {isListening ? 'Listening' : listener.status === 'expired' ? 'Expired' : listener.status === 'error' ? 'Error' : 'Stopped'}
                            </span>
                            <span className={styles.listenerMeta}>:{listener.port}</span>
                            {isListening && (
                                <span className={styles.pollingIndicator}>waiting for connections…</span>
                            )}
                        </div>
                        {listener.connections.length === 0
                            ? <p className={styles.emptyState}>No connections yet.</p>
                            : <div className={styles.connectionList}>
                                {listener.connections.map((conn, i) => (
                                    <div key={i} className={styles.connectionCard}>
                                        <div className={styles.connectionMeta}>
                                            <span className={styles.connectionClient}>
                                                {conn.client_ip}:{conn.client_port}
                                            </span>
                                            <span className={styles.connectionTime}>
                                                {new Date(conn.connected_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        {conn.data
                                            ? <pre className={styles.connectionData}>{conn.data}</pre>
                                            : <p className={styles.connectionNoData}>No data received</p>
                                        }
                                    </div>
                                ))}
                            </div>
                        }
                    </>
                )}
            </div>
        </div>
    )
}
