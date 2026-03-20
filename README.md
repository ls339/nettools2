# Nettools2

A microservices-based network tools application with a tabbed UI for common network diagnostics.

## Architecture

```
Browser
  └─► Nginx :8080
        ├─► /api/*  ──► FastAPI :5001
        │                  └─► Celery Worker (port scans)
        │                         ├─► RabbitMQ (task queue)
        │                         └─► MongoDB  (results)
        └─► /*      ──► Next.js :3000
```

| Service | Image | Role |
|---|---|---|
| `nginx` | nginx:alpine | Reverse proxy, TLS termination, security headers |
| `api` | python:3.12-slim | FastAPI — all HTTP endpoints, rate limiting |
| `worker` | python:3.12-slim | Celery — executes async port scan tasks |
| `frontend` | node:18-alpine | Next.js UI |
| `broker` | rabbitmq:management-alpine | Celery task queue |
| `mongodb` | mongo | Persists port scan results |

## Features

| Tool | Tab | Description |
|---|---|---|
| IP Detection | navbar | Client's real IP detected from proxy headers, shown on every page |
| Port Scanner | Discovery | Queue async TCP scans; results auto-refresh and persist in MongoDB |
| DNS Lookup | Discovery | Resolve A, AAAA, MX, TXT, CNAME, NS, PTR, SOA records |
| Ping | Diagnostics | ICMP ping with packet stats and RTT (min/avg/max) |
| Traceroute | Diagnostics | Path trace with per-hop RTT, up to 20 hops |
| SSL/TLS Inspector | Security | Certificate details: issuer, validity, SANs, cipher suite, TLS version |

## Security

| Control | Detail |
|---|---|
| Rate limiting | Per-IP sliding window, in-memory, no external deps — port scan 5/min, DNS 30/min, ping 10/min, traceroute 5/min, SSL 10/min |
| API key auth | Optional `X-API-Key` header; enforced when `API_KEY` env var is set |
| Private IP scanning | Blocked by default; opt in with `ALLOW_PRIVATE_SCAN=true` |
| Input validation | Host, port range, DNS record type, pagination limit validated at every endpoint |
| CSP header | `Content-Security-Policy` set by Nginx on all responses |
| Port range cap | Port scans limited to 1000 ports per request |

## Installation

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker + Docker Compose (Linux)

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd nettools2/mayor/rig
   ```

2. Create a `.env` file:
   ```bash
   cp .env_example .env
   ```

3. Edit `.env` — required values:
   ```
   MONGO_ROOT_USERNAME=root
   MONGO_ROOT_PASSWORD=your_secure_password
   RABBITMQ_USER=guest
   RABBITMQ_PASSWORD=guest
   ```

4. Start all services:
   ```bash
   docker compose up --build
   ```

### Services

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API interactive docs | http://localhost:8080/api/docs |
| RabbitMQ management | http://localhost:15672 |
| API (direct) | http://localhost:8000 |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_ROOT_USERNAME` | *(required)* | MongoDB root username |
| `MONGO_ROOT_PASSWORD` | *(required)* | MongoDB root password |
| `RABBITMQ_USER` | `guest` | RabbitMQ username |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `API_KEY` | *(unset)* | When set, all API requests must include `X-API-Key: <value>` |
| `ALLOW_PRIVATE_SCAN` | `false` | Set to `true` to allow scanning private/loopback IPs |
| `LISTENER_PORT_MIN` | `7100` | Lower bound of the TCP listener port range |
| `LISTENER_PORT_MAX` | `7109` | Upper bound of the TCP listener port range |

## API Endpoints

All endpoints are served under the `/api` prefix via Nginx.

### IP

| Method | Path | Description |
|---|---|---|
| `GET` | `/myip` | Returns the client's IP address |

### Port Scanner

| Method | Path | Params | Description |
|---|---|---|---|
| `POST` | `/portscan/{host}` | `port_start`, `port_end` | Queue an async TCP port scan (max 1000 ports) |
| `GET` | `/port/scanned` | `limit` (default 100, max 500) | List completed scan results |
| `DELETE` | `/port/scanned/{task_id}` | — | Delete a scan result |

Port scan results are stored in MongoDB by the Celery worker. The UI polls until results appear.

> To scan ports on your local machine from inside Docker, use `host.docker.internal` as the host.

### DNS

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/dns/{host}` | `record_type` (default `A`) | DNS lookup. Valid types: `A`, `AAAA`, `MX`, `TXT`, `CNAME`, `NS`, `PTR`, `SOA` |

### Diagnostics

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/ping/{host}` | `count` (1–10, default 4) | ICMP ping with packet stats and RTT |
| `GET` | `/traceroute/{host}` | — | Traceroute, max 20 hops |

### SSL/TLS

| Method | Path | Params | Description |
|---|---|---|---|
| `GET` | `/ssl/{host}` | `port` (default 443) | Inspect TLS certificate. Falls back to unverified inspection for self-signed certs. |

## Development

### Running API tests

```bash
# Build the test image
docker build -t nettools-api -f src/api/dockerfile src/

# Run pytest
docker run --rm nettools-api python -m pytest src/api/tests/ -v
```

### Running E2E tests

The stack must be running (`docker compose up -d`) before running E2E tests.

```bash
cd src/ui
npx playwright test
```

### Linting

The API uses [ruff](https://docs.astral.sh/ruff/) for linting:

```bash
docker run --rm nettools-api ruff check src/api/
```

### Rebuilding after code changes

```bash
# Rebuild and restart a single service
docker compose build api && docker compose up -d api

# Rebuild everything
docker compose up --build
```

## Key Files

```
src/
├── api/
│   ├── app/
│   │   ├── main.py          # All API routes, rate limiting, host validation
│   │   └── db.py            # MongoDB connection
│   ├── tests/
│   │   └── test_main.py     # pytest unit tests (42+ tests)
│   └── dockerfile
├── worker/
│   └── task/
│       ├── tasks.py         # Celery task definitions
│       └── portscanner.py   # TCP port scanning logic
├── ui/
│   ├── app/nettools/
│   │   ├── page.tsx         # Tabbed page with IP in navbar
│   │   ├── port-scanner.tsx # Port scanner with auto-polling
│   │   ├── dns-lookup.tsx   # DNS lookup
│   │   ├── ping-tool.tsx    # Ping
│   │   ├── traceroute-tool.tsx
│   │   ├── ssl-inspector.tsx
│   │   ├── navbar.tsx       # Navbar with live IP badge
│   │   └── styles.module.css
│   └── tests/e2e/
│       └── nettools.spec.ts # Playwright E2E tests (12 flows)
└── nginx/
    └── nginx.conf           # Reverse proxy + security headers (CSP, X-Frame, etc.)
```
