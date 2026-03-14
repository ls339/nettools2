import Link from 'next/link'
import styles from './styles.module.css'

const NAV_LINKS = [
    { href: '/nettools', label: 'Port Scanner' },
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