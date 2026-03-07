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
        <div>
            Your IP Address:
            <IpAddress />
            <br></br>
            <h1 className={styles.header}>Port Scanner</h1>
            <PortScanForm />
            <ScannedHostList initialResults={scanned_hosts.results} />
        </div>
    )
}
