# Nettools2

A microservices-based network tools app for local use — port scanning and client IP detection.

## Architecture

- **Frontend**: Next.js 15 / React 19 (TypeScript) — `src/ui/`
- **API**: FastAPI Python — `src/api/`
- **Worker**: Celery — `src/worker/`
- **Infra**: Nginx (port 8080), RabbitMQ, MongoDB
- **Orchestration**: Docker Compose

Nginx proxies `/api/` → FastAPI and `/` → Next.js. All frontend data fetching is client-side so Playwright can mock API calls via `page.route()`.

## Common Commands

```bash
docker compose up --build -d        # start stack
docker compose down                 # stop stack
docker run --rm nettools-api python -m pytest src/api/tests/ -v   # API unit tests
docker run --rm nettools-api python -m ruff check src/api src/worker  # lint
cd src/ui && npm run test:e2e       # Playwright E2E tests (stack must be running)
```

## Development Rules

- **Never run `docker compose up` without `-d`** — it blocks the terminal
- **All frontend data fetching must be client-side** — SSR fetches break Playwright mocking
- **Python version**: 3.12-slim (do not upgrade without testing)
- **Do not commit `.env`** — it contains MongoDB credentials

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`
- Branch naming: `feature/name`, `tests/name`
- Merge feature branches into main, delete after — no long-lived branches
- No Co-Authored-By in commits

## Testing Philosophy

- API: pytest with `unittest.mock` — mock Celery and MongoDB, never hit real services
- Frontend: Playwright user-flow tests — mock all API calls via `page.route()`
- Always update tests when changing API contracts or UI behaviour

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/myip` | Returns client IP |
| POST | `/api/portscan/{host}?port_start=&port_end=` | Queues scan task |
| GET | `/api/port/scanned` | Returns all scan results |
| DELETE | `/api/port/scanned/{task_id}` | Deletes a result |

Port range is validated (1–65535, start ≤ end) before queuing.
