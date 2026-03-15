import ipaddress
import json
import os
import re
import socket
import ssl
import subprocess

import dns.resolver
from fastapi import Depends, FastAPI, HTTPException, Request, Security
from fastapi.security.api_key import APIKeyHeader

from src.worker.task.tasks import portscan
from .db import db, MONGO_DB_COLLECTION

# --- API key auth (optional — only enforced when API_KEY env var is set) ---
_API_KEY = os.getenv("API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _verify_api_key(api_key: str = Security(_api_key_header)):
    if _API_KEY and api_key != _API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


# --- Host validation ---
_HOSTNAME_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?))*\.?)$"
)
_ALLOW_PRIVATE_SCAN = os.getenv("ALLOW_PRIVATE_SCAN", "false").lower() == "true"
_MAX_PORT_RANGE = 1000


def _validate_host(host: str) -> None:
    if len(host) > 253:
        raise HTTPException(status_code=422, detail="Host too long")
    try:
        addr = ipaddress.ip_address(host)
        if not _ALLOW_PRIVATE_SCAN and (addr.is_private or addr.is_loopback or addr.is_link_local):
            raise HTTPException(status_code=422, detail="Private/loopback addresses are not allowed. Set ALLOW_PRIVATE_SCAN=true to enable.")
        return
    except HTTPException:
        raise
    except ValueError:
        pass
    if not _HOSTNAME_RE.match(host):
        raise HTTPException(status_code=422, detail="Invalid host: must be a valid hostname or IP address")


API_VERSION = "v1"
app = FastAPI(
    title="Purenix Net Tools",
    description="Various networking tools.",
    version="0.0.1",
    root_path="/api",
    dependencies=[Depends(_verify_api_key)],
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
        raw = request.headers.get(header)
        if raw:
            candidate = raw.split(",")[0].strip()
            try:
                ipaddress.ip_address(candidate)
                return {"client_host": candidate}
            except ValueError:
                continue  # malformed header — try next or fall through

    # Fallback to direct client host if no proxy headers found
    return {"client_host": request.client.host}


@app.post(
    "/portscan/{host}",
    responses={202: {"message": "ok", "id": "somestring"}},
)
def portscanner(host: str, port_start: int, port_end: int):
    _validate_host(host)
    if not (1 <= port_start <= 65535) or not (1 <= port_end <= 65535) or port_start > port_end:
        raise HTTPException(status_code=422, detail="Invalid port range")
    if (port_end - port_start + 1) > _MAX_PORT_RANGE:
        raise HTTPException(status_code=422, detail=f"Port range too large: maximum {_MAX_PORT_RANGE} ports per scan")
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
    _validate_host(host)
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
    _validate_host(host)
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
    _validate_host(host)
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


def _get_cert(host: str, port: int, verify: bool):
    ctx = ssl.create_default_context() if verify else ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    with socket.create_connection((host, port), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            return ssock.getpeercert(binary_form=not verify), ssock.cipher(), verify


@app.get("/ssl/{host}")
def ssl_inspect(host: str, port: int = 443):
    _validate_host(host)
    try:
        try:
            raw_cert, cipher, verified = _get_cert(host, port, verify=True)
            cert = raw_cert
        except ssl.SSLCertVerificationError:
            # Retry without verification so we can still inspect the cert
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with socket.create_connection((host, port), timeout=10) as sock:
                with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()
                    cipher = ssock.cipher()
            verified = False

        subject = dict(x[0] for x in cert.get("subject", []))
        issuer = dict(x[0] for x in cert.get("issuer", []))
        sans = [v for k, v in cert.get("subjectAltName", []) if k == "DNS"]
        return {
            "host": host,
            "port": port,
            "verified": verified,
            "common_name": subject.get("commonName"),
            "issuer": issuer.get("organizationName"),
            "not_before": cert.get("notBefore"),
            "not_after": cert.get("notAfter"),
            "sans": sans,
            "cipher": cipher[0] if cipher else None,
            "protocol": cipher[1] if cipher else None,
        }
    except (socket.timeout, TimeoutError):
        raise HTTPException(status_code=408, detail="Connection timed out")
    except (socket.gaierror, ConnectionRefusedError, OSError) as e:
        raise HTTPException(status_code=400, detail=f"Connection error: {e}")
