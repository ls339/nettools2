import styles from './styles.module.css'
import IpAddress from './ip-address'
import PortScanForm from './port-scan-form'
import ScannedHostList from './scanned-host-list'
import DnsLookup from './dns-lookup'
import PingTool from './ping-tool'
import TracerouteTool from './traceroute-tool'
import SslInspector from './ssl-inspector'

export default function Page() {
    return (
        <div className={styles.page}>
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Your IP Address</h2>
                <IpAddress />
            </section>

            <hr className={styles.divider} />

            <section id="port-scanner" className={styles.section}>
                <h2 className={styles.sectionTitle}>Port Scanner</h2>
                <p className={styles.sectionSubtitle}>Enter a host and port range to queue a scan.</p>
                <PortScanForm />
            </section>

            <hr className={styles.divider} />

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Scan Results</h2>
                <ScannedHostList />
            </section>

            <hr className={styles.divider} />

            <section id="dns-lookup" className={styles.section}>
                <h2 className={styles.sectionTitle}>DNS Lookup</h2>
                <p className={styles.sectionSubtitle}>Query DNS records for a domain.</p>
                <DnsLookup />
            </section>

            <hr className={styles.divider} />

            <section id="ping" className={styles.section}>
                <h2 className={styles.sectionTitle}>Ping</h2>
                <p className={styles.sectionSubtitle}>Send ICMP echo requests and measure round-trip time.</p>
                <PingTool />
            </section>

            <hr className={styles.divider} />

            <section id="traceroute" className={styles.section}>
                <h2 className={styles.sectionTitle}>Traceroute</h2>
                <p className={styles.sectionSubtitle}>Trace the network path to a host.</p>
                <TracerouteTool />
            </section>

            <hr className={styles.divider} />

            <section id="ssl-inspector" className={styles.section}>
                <h2 className={styles.sectionTitle}>SSL / TLS Inspector</h2>
                <p className={styles.sectionSubtitle}>Inspect the SSL certificate for a hostname.</p>
                <SslInspector />
            </section>
        </div>
    )
}
