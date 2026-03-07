'use client'

import { useEffect, useState } from 'react'
import styles from './styles.module.css'

export default function IpAddress() {
    const [ip, setIp] = useState<string>('...')

    useEffect(() => {
        fetch('/api/myip')
            .then(res => res.json())
            .then(data => setIp(data.client_host))
            .catch(() => setIp('unavailable'))
    }, [])

    return <div className={styles.hostaddress}>{ip}</div>
}
