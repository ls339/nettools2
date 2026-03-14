import socket
from concurrent.futures import ThreadPoolExecutor, as_completed

COMMON_SERVICES = {
    20: "FTP-data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
    53: "DNS", 67: "DHCP", 68: "DHCP", 69: "TFTP", 80: "HTTP",
    110: "POP3", 111: "RPC", 119: "NNTP", 123: "NTP", 135: "RPC",
    137: "NetBIOS", 138: "NetBIOS", 139: "NetBIOS", 143: "IMAP",
    161: "SNMP", 162: "SNMP", 194: "IRC", 389: "LDAP", 443: "HTTPS",
    445: "SMB", 465: "SMTPS", 514: "Syslog", 587: "SMTP", 636: "LDAPS",
    993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle",
    2049: "NFS", 2375: "Docker", 2376: "Docker", 3000: "Dev",
    3306: "MySQL", 3389: "RDP", 4000: "Dev", 5000: "Dev", 5432: "PostgreSQL",
    5672: "AMQP", 5900: "VNC", 6379: "Redis", 6443: "K8s",
    8000: "HTTP-alt", 8080: "HTTP-alt", 8443: "HTTPS-alt", 8888: "HTTP-alt",
    9200: "Elasticsearch", 9300: "Elasticsearch", 15672: "RabbitMQ",
    27017: "MongoDB", 27018: "MongoDB", 27019: "MongoDB",
}


def _check_port(host: str, port: int) -> int | None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            s.connect((host, port))
            return port
        except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError):
            return None


def portscanner(host: str, port_start: int, port_end: int) -> dict:
    ports = range(port_start, port_end + 1)
    open_ports = []

    with ThreadPoolExecutor(max_workers=min(256, len(ports))) as executor:
        futures = {executor.submit(_check_port, host, p): p for p in ports}
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                open_ports.append(result)

    open_ports.sort()

    open_ports_with_services = [
        {"port": p, "service": COMMON_SERVICES.get(p)} for p in open_ports
    ]

    return {
        "host": host,
        "range": [port_start, port_end],
        "open_ports": open_ports_with_services,
    }
