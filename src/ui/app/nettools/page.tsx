import styles from './styles.module.css'
import IpAddress from './ip-address'
import PortScanForm from './port-scan-form'

export const dynamic = 'force-dynamic'


function PortScannedHost(props) {
    const ListItems = props.open_ports.map((port) => <li key={port.toString()}>{port}</li>);
    return (
        <div className={styles.openports}>
            <div>
                <p>
                    {props.host}
                </p>
                <p>
                    {props.port_range[0]} - {props.port_range[1]}
                </p>
            </div>
            <ul>
                open
                {ListItems}
            </ul>
        </div>
    )
}

function PortScannedHostList(props) {
    const port_scanned_hosts = props.scanned_hosts.results
    const portScannedListItems = port_scanned_hosts.map((host) => { return <PortScannedHost host={host.host} open_ports={host.open_ports} port_range={host.range}/>});
    return (
        <div>
            {portScannedListItems}
        </div>)
}


async function getScannedPorts(id: number) {
    // const res = await fetch('http://127.0.0.1:8000/port/scanned/' + id)
    const res = await fetch('http://api:5001/port/scanned/' + id)
    if (!res.ok) {
        // This will activate the closest `error.js` Error Boundary
        throw new Error('Failed to fetch data')
    }

    return res.json()
}

export default async function Page() {
    const scanned_hosts = await getScannedPorts(100)
    return (
        <div>
            Your IP Address:
            <IpAddress />
            <br></br>
            <h1 className={styles.header}>Port Scanner</h1>
            <PortScanForm />
            <PortScannedHostList scanned_hosts={scanned_hosts}/>
        </div>
    )
}
