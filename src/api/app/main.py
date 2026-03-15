import json
import re
import socket
import ssl
import subprocess

import dns.resolver
from fastapi import FastAPI, HTTPException, Request

from src.worker.task.tasks import portscan
from .db import db, MONGO_DB_COLLECTION


API_VERSION = "v1"
app = FastAPI(
    title="Purenix Net Tools",
    description="Various networking tools.",
    version="0.0.1",
    root_path="/api",
)


@app.get(
    "/myip",
    responses={
        200: {
            "description": "Client host",
            "content": {"application/json": {"example": {"client_host": "127.0.0.1"}}},
        }
    },
)
def get_myip(request: Request):
    # Try multiple headers that proxies use to pass real client IP
    for header in ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"]:
        client_host = request.headers.get(header)
        if client_host:
            # X-Forwarded-For can contain multiple IPs, take the first one
            client_host = client_host.split(",")[0].strip()
            return {"client_host": client_host}

    # Fallback to direct client host if no proxy headers found
    return {"client_host": request.client.host}


@app.post(
    "/portscan/{host}",
    responses={202: {"message": "ok", "id": "somestring"}},
)
def portscanner(host: str, port_start: int, port_end: int):
    if not (1 <= port_start <= 65535) or not (1 <= port_end <= 65535) or port_start > port_end:
        raise HTTPException(status_code=422, detail="Invalid port range")
    result = portscan.delay(host, port_start, port_end)
    return {
        "message": "ok",
        "id": result.id,
    }


@app.get(
    "/port/scanned",
    responses={200: {"open_ports": [1, 2, 3]}},
)
async def portscanned():
    collection = list(db[MONGO_DB_COLLECTION].find())
    results = []
    for result in collection:
        try:
            results.append(json.loads(result["result"]))
        except (KeyError, json.JSONDecodeError):
            pass
    return {"results": results}


@app.delete("/port/scanned/{task_id}", responses={200: {"message": "deleted"}})
async def delete_portscanned(task_id: str):
    result = db[MONGO_DB_COLLECTION].delete_one({"_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scan result not found")
    return {"message": "deleted"}


VALID_RECORD_TYPES = {"A", "AAAA", "MX", "TXT", "CNAME", "NS", "PTR", "SOA"}


@app.get("/dns/{host}")
def dns_lookup(host: str, record_type: str = "A"):
    if record_type.upper() not in VALID_RECORD_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid record type. Valid types: {', '.join(sorted(VALID_RECORD_TYPES))}")
    try:
        answers = dns.resolver.resolve(host, record_type.upper())
        return {"host": host, "record_type": record_type.upper(), "records": [str(r) for r in answers]}
    except dns.resolver.NXDOMAIN:
        raise HTTPException(status_code=404, detail="Domain not found")
    except dns.resolver.NoAnswer:
        return {"host": host, "record_type": record_type.upper(), "records": []}
    except dns.resolver.Timeout:
        raise HTTPException(status_code=408, detail="DNS query timed out")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/ping/{host}")
def ping_host(host: str, count: int = 4):
    if not (1 <= count <= 10):
        raise HTTPException(status_code=422, detail="Count must be between 1 and 10")
    try:
        result = subprocess.run(
            ["ping", "-c", str(count), "-W", "2", host],
            capture_output=True, text=True, timeout=30,
        )
        packet_match = re.search(r"(\d+) packets transmitted, (\d+) (?:packets )?received", result.stdout)
        rtt_match = re.search(r"(\d+\.?\d*)/(\d+\.?\d*)/(\d+\.?\d*)", result.stdout)
        packets_sent = int(packet_match.group(1)) if packet_match else count
        packets_recv = int(packet_match.group(2)) if packet_match else 0
        return {
            "host": host,
            "packets_sent": packets_sent,
            "packets_received": packets_recv,
            "packet_loss_pct": round((packets_sent - packets_recv) / packets_sent * 100),
            "rtt_min": float(rtt_match.group(1)) if rtt_match else None,
            "rtt_avg": float(rtt_match.group(2)) if rtt_match else None,
            "rtt_max": float(rtt_match.group(3)) if rtt_match else None,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Ping timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="ping command not available")


@app.get("/traceroute/{host}")
def traceroute_host(host: str):
    try:
        result = subprocess.run(
            ["traceroute", "-m", "20", "-w", "2", host],
            capture_output=True, text=True, timeout=90,
        )
        hops = []
        for line in result.stdout.strip().split("\n")[1:]:
            hop_match = re.match(r"\s*(\d+)\s+(.*)", line)
            if not hop_match:
                continue
            hop_num = int(hop_match.group(1))
            rest = hop_match.group(2).strip()
            if rest.startswith("*"):
                hops.append({"hop": hop_num, "host": None, "ip": None, "rtt_ms": None})
            else:
                ip_match = re.search(r"\(([^)]+)\)", rest)
                rtt_match = re.search(r"(\d+\.?\d*)\s+ms", rest)
                hostname = rest.split("(")[0].strip() if "(" in rest else rest.split()[0]
                hops.append({
                    "hop": hop_num,
                    "host": hostname,
                    "ip": ip_match.group(1) if ip_match else None,
                    "rtt_ms": float(rtt_match.group(1)) if rtt_match else None,
                })
        return {"host": host, "hops": hops}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Traceroute timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="traceroute command not available")


@app.get("/ssl/{host}")
def ssl_inspect(host: str, port: int = 443):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                cipher = ssock.cipher()
        subject = dict(x[0] for x in cert.get("subject", []))
        issuer = dict(x[0] for x in cert.get("issuer", []))
        sans = [v for k, v in cert.get("subjectAltName", []) if k == "DNS"]
        return {
            "host": host,
            "port": port,
            "common_name": subject.get("commonName"),
            "issuer": issuer.get("organizationName"),
            "not_before": cert.get("notBefore"),
            "not_after": cert.get("notAfter"),
            "sans": sans,
            "cipher": cipher[0] if cipher else None,
            "protocol": cipher[1] if cipher else None,
        }
    except ssl.SSLCertVerificationError as e:
        raise HTTPException(status_code=400, detail=f"SSL verification failed: {e}")
    except (socket.timeout, TimeoutError):
        raise HTTPException(status_code=408, detail="Connection timed out")
    except (socket.gaierror, ConnectionRefusedError, OSError) as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {e}")
