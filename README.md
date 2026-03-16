# Nettools2

A microservices-based network tools application with a tabbed UI for common network diagnostics.

## Architecture

- **Frontend**: Next.js 15 / React 19 (TypeScript) — served via Nginx reverse proxy
- **API**: FastAPI Python backend
- **Worker**: Celery worker for async port scanning tasks
- **Infrastructure**: Nginx, RabbitMQ message broker, MongoDB

## Features

- **IP detection** — client's real IP address shown in the navbar on every page
- **Port scanner** — queue an async TCP port scan against a host and port range; results auto-refresh and are persisted in MongoDB
- **DNS lookup** — resolve A, AAAA, MX, TXT, CNAME, NS, PTR, or SOA records for any domain
- **Ping** — send ICMP pings to a host and see packet stats and round-trip times
- **Traceroute** — trace the network path to a host with per-hop RTT
- **SSL/TLS inspector** — inspect a host's certificate: issuer, validity dates, SANs, cipher suite, and TLS version

## Security

- **Rate limiting** — per-IP sliding window limits per endpoint (no external dependencies): port scan 5/min, DNS 30/min, ping 10/min, traceroute/SSL 5–10/min
- **API key auth** — optional; enforced when `API_KEY` env var is set (`X-API-Key` header)
- **Private IP scanning** — blocked by default; opt in with `ALLOW_PRIVATE_SCAN=true`
- **Input validation** — host, port range, DNS record type, and pagination limit all validated before processing
- **CSP header** — `Content-Security-Policy` enforced via Nginx

## Installation

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker + Docker Compose (Linux)

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd nettools2/mayor/rig
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env_example .env
   ```
   Edit `.env` and set secure values:
   ```
   MONGO_ROOT_USERNAME=root
   MONGO_ROOT_PASSWORD=your_secure_password
   RABBITMQ_USER=guest
   RABBITMQ_PASS=guest
   ```
   Optional settings:
   ```
   API_KEY=your_api_key          # enforce X-API-Key header on all requests
   ALLOW_PRIVATE_SCAN=true       # allow scanning private/loopback IPs (e.g. home network)
   ```

3. Start all services:
   ```bash
   docker compose up --build
   ```

### Services

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API docs | http://localhost:8080/api/docs |
| RabbitMQ management | http://localhost:15672 |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/myip` | Returns the client's IP address |
| `POST` | `/portscan/{host}?port_start=X&port_end=Y` | Queues a port scan task (max 1000 ports) |
| `GET` | `/port/scanned?limit=100` | Returns scan results (default 100, max 500) |
| `DELETE` | `/port/scanned/{task_id}` | Deletes a scan result |
| `GET` | `/dns/{host}?record_type=A` | DNS lookup (A, AAAA, MX, TXT, CNAME, NS, PTR, SOA) |
| `GET` | `/ping/{host}?count=4` | Ping a host (1–10 packets) |
| `GET` | `/traceroute/{host}` | Traceroute to a host (max 20 hops) |
| `GET` | `/ssl/{host}?port=443` | Inspect TLS certificate |

## Key Files

- `src/api/app/main.py` — API routes, rate limiting, host validation
- `src/api/app/db.py` — MongoDB connection
- `src/worker/task/tasks.py` — Celery task definitions
- `src/worker/task/portscanner.py` — Core port scanning logic
- `src/ui/app/nettools/page.tsx` — Tabbed main page with IP in navbar
- `src/ui/app/nettools/port-scanner.tsx` — Port scanner with auto-polling results
- `src/nginx/nginx.conf` — Nginx reverse proxy and security headers
