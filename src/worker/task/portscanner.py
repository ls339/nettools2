import socket


def portscanner(host: str, port_start: int, port_end: int):
    open_ports = []
    for x in range(port_start, port_end + 1):
        print(f"port scanning {x}")
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.connect((host, x))
            open_ports.append(x)
        except Exception:
            pass
        s.close()
    return {
        "host": host,
        "range": [port_start, port_end],
        "open_ports": open_ports,
    }
