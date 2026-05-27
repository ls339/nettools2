'use client'

import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import styles from './styles.module.css'

export function Navbar() {
    const [ip, setIp] = useState<string>('...')
    const { data: session } = useSession()

    useEffect(() => {
        fetch('/api/myip')
            .then(res => res.json())
            .then(data => setIp(data.client_host))
            .catch(() => setIp('—'))
    }, [])

    return (
        <nav className={styles.navbar}>
            <span className={styles.navBrand}>PureNix NetTools</span>
            <div className={styles.navRight}>
                <div className={styles.navIp}>
                    <span className={styles.navIpLabel}>Your IP</span>
                    <span className={styles.navIpValue}>{ip}</span>
                </div>
                {session?.user && (
                    <>
                        <span className={styles.navUser}>{session.user.name}</span>
                        <button className={styles.signOutButton} onClick={() => signOut()}>
                            Sign out
                        </button>
                    </>
                )}
            </div>
        </nav>
    )
}
