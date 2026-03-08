import socket


def portscanner(host: str, port_start: int, port_end: int) -> dict:
    open_ports = []
    for x in range(port_start, port_end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            try:
                s.connect((host, x))
                open_ports.append(x)
            except (socket.timeout, socket.gaierror, ConnectionRefusedError, OSError):
                pass
    return {
        "host": host,
        "range": [port_start, port_end],
        "open_ports": open_ports,
    }
