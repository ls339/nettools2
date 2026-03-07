import styles from './styles.module.css'
import IpAddress from './ip-address'
import PortScanForm from './port-scan-form'
import ScannedHostList from './scanned-host-list'

export const dynamic = 'force-dynamic'

async function getScannedPorts() {
    const res = await fetch('http://api:5001/port/scanned/100')
    if (!res.ok) {
        throw new Error('Failed to fetch data')
    }
    return res.json()
}

export default async function Page() {
    const scanned_hosts = await getScannedPorts()
    return (
        <div className={styles.page}>
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Your IP Address</h2>
                <IpAddress />
            </section>

            <hr className={styles.divider} />

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Port Scanner</h2>
                <p className={styles.sectionSubtitle}>Enter a host and port range to queue a scan.</p>
                <PortScanForm />
            </section>

            <hr className={styles.divider} />

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Scan Results</h2>
                <ScannedHostList initialResults={scanned_hosts.results} />
            </section>
        </div>
    )
}
