# dsa-web — DSA evidence frontend (Next 16.3.4 + React 19 + Tailwind 3.4)

Independent app. **Not merged into root npm workspaces** (root is Next 16.2 +
Tailwind v4; dual lockfiles kept on purpose, `turbopack.root` pinned in
`next.config.ts` — see comment there). UI design language frozen; `lib/api.ts`
signatures (`API_BASE_URL`, `apiUrl()`) frozen — backend contract lives in
`openapi.json` (OpenAPI 3.1) with generated types in `lib/api-types.ts`.

Backend choice: **A) standalone FastAPI** (`services/dsa-api`, Uvicorn `:8000`).

## 三条命令

```bash
# 1. 启动 (frontend :3001, api :8000)
npm --prefix apps/dsa-web run dev -- --port 3001
services/dsa-api/.venv/bin/uvicorn app.main:app --port 8000 --app-dir services/dsa-api
# 或一键拉起: docker compose up (repo root)

# 2. 联调 (contract check against the real API)
curl -s http://localhost:8000/health
curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; print(len(json.load(sys.stdin)['paths']), 'paths')"
# docs: http://localhost:8000/docs

# 3. 测试
npm --prefix apps/dsa-web run typecheck   # tsc --noEmit
npm --prefix apps/dsa-web run test        # vitest (unit + MSW contract)
E2E_MOCK=1 npm --prefix apps/dsa-web run test:e2e:mock 2>/dev/null || \
  E2E_MOCK=1 npx playwright test --project=chrome-1280x720 --project=mobile-390
```

`E2E_MOCK=1` intercepts `http://localhost:8000` with `mocks/fixtures.ts`
(MSW handlers + Playwright `page.route`); unset → tests hit the real backend.

## Env

See `.env.example`. `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`)
overrides the API origin without touching `lib/api.ts`.

## Deploy

- Web (Vercel): root `apps/dsa-web`, framework Next.js, env
  `NEXT_PUBLIC_API_BASE_URL=<api-url>`. No build tweaks needed.
- API (Docker): `services/dsa-api/Dockerfile` (`FROM python:3.12-slim`),
  `docker build -t dsa-api services/dsa-api && docker run -p 8000:8000 dsa-api`.
