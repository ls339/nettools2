import Link from 'next/link'
import styles from './styles.module.css'

const NAV_LINKS = [
    { href: '/nettools#port-scanner', label: 'Port Scanner' },
    { href: '/nettools#dns-lookup', label: 'DNS' },
    { href: '/nettools#ping', label: 'Ping' },
    { href: '/nettools#traceroute', label: 'Traceroute' },
    { href: '/nettools#ssl-inspector', label: 'SSL' },
]

export function Navbar() {
    return (
        <nav className={styles.navbar}>
            <span className={styles.navBrand}>PureNix NetTools</span>
            <div className={styles.navLinks}>
                {NAV_LINKS.map(({ href, label }) => (
                    <Link key={href} href={href} className={styles.navLink}>{label}</Link>
                ))}
            </div>
        </nav>
    )
}