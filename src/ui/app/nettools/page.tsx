import styles from './styles.module.css'
import IpAddress from './ip-address'
import PortScanForm from './port-scan-form'
import ScannedHostList from './scanned-host-list'

export default function Page() {
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
                <ScannedHostList />
            </section>
        </div>
    )
}
