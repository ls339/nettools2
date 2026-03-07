# Nettools2

A microservices-based network tools application for port scanning and IP detection.

## Architecture

- **Frontend**: Next.js 15 / React 19 (TypeScript) — served via Nginx reverse proxy
- **API**: FastAPI Python backend
- **Worker**: Celery worker for async port scanning tasks
- **Infrastructure**: Nginx, RabbitMQ message broker, MongoDB

## Features

- **IP detection** — displays the client's real IP address (detected client-side via the browser)
- **Port scanner** — enter a host and port range to queue an async scan; results are stored in MongoDB and displayed in the UI
  - To scan ports on your local machine from within Docker, use `host.docker.internal` as the host

## Installation

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker + Docker Compose (Linux)

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd nettools2
   ```

2. Create a `.env` file from the example and set a secure MongoDB password:
   ```bash
   cp .env_example .env
   ```
   Edit `.env`:
   ```
   MONGO_ROOT_USERNAME=root
   MONGO_ROOT_PASSWORD=your_secure_password
   ```

3. Start all services:
   ```bash
   docker compose up --build
   ```

### Services

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API | http://localhost:8000 |
| RabbitMQ management | http://localhost:15672 |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/myip` | Returns the client's IP address |
| `POST` | `/portscan/{host}?port_start=X&port_end=Y` | Queues a port scan task |
| `GET` | `/port/scanned/{id}` | Returns all scan results |

## Key Files

- `src/api/app/main.py` — API routes
- `src/api/app/db.py` — MongoDB connection
- `src/worker/task/tasks.py` — Celery task definitions
- `src/worker/task/portscanner.py` — Core port scanning logic
- `src/ui/app/nettools/page.tsx` — Main page
- `src/ui/app/nettools/port-scan-form.tsx` — Port scan input form
- `src/ui/app/nettools/ip-address.tsx` — Client-side IP display
- `src/nginx/nginx.conf` — Nginx reverse proxy config
