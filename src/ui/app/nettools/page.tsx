'use client'

import { useState } from 'react'
import styles from './styles.module.css'
import PortScanner from './port-scanner'
import DnsLookup from './dns-lookup'
import PingTool from './ping-tool'
import TracerouteTool from './traceroute-tool'
import SslInspector from './ssl-inspector'
import TcpListener from './tcp-listener'

type Tab = 'port-scanner' | 'dns' | 'ping' | 'traceroute' | 'ssl' | 'tcp-listener'

const TAB_GROUPS = [
    {
        label: 'Discovery',
        tabs: [
            { id: 'port-scanner' as Tab, label: 'Port Scanner' },
            { id: 'dns' as Tab, label: 'DNS' },
        ],
    },
    {
        label: 'Diagnostics',
        tabs: [
            { id: 'ping' as Tab, label: 'Ping' },
            { id: 'traceroute' as Tab, label: 'Traceroute' },
            { id: 'tcp-listener' as Tab, label: 'TCP Listener' },
        ],
    },
    {
        label: 'Security',
        tabs: [
            { id: 'ssl' as Tab, label: 'SSL / TLS' },
        ],
    },
]

export default function Page() {
    const [activeTab, setActiveTab] = useState<Tab>('port-scanner')

    return (
        <div className={styles.toolPage}>
            <div className={styles.tabBar}>
                {TAB_GROUPS.map((group, gi) => (
                    <div key={group.label} className={styles.tabGroup}>
                        {gi > 0 && <div className={styles.tabGroupDivider} />}
                        <div className={styles.tabGroupInner}>
                            <span className={styles.tabGroupLabel}>{group.label}</span>
                            <div className={styles.tabGroupTabs}>
                                {group.tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.toolContent}>
                {activeTab === 'port-scanner' && <PortScanner />}
                {activeTab === 'dns' && <DnsLookup />}
                {activeTab === 'ping' && <PingTool />}
                {activeTab === 'traceroute' && <TracerouteTool />}
                {activeTab === 'ssl' && <SslInspector />}
                {activeTab === 'tcp-listener' && <TcpListener />}
            </div>
        </div>
    )
}
