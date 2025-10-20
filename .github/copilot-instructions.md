<!-- Copilot instructions for contributors and AI assistants -->
# Quick onboard: the11 (Social Garden SOW Generator)

This file contains focused, actionable guidance for AI coding agents working in this repository. Keep edits short and always reference the specific files below.

- Architecture (big picture)
  - Frontend: Next.js app under `frontend/app/` (React + Tiptap editor). UI routes and server actions live in `frontend/app/*` and `frontend/app/api/*`.
  - Backend PDF service: FastAPI app at `backend/main.py` using WeasyPrint to render HTML -> PDF. It runs on port 8000 by default.
  - Process management / deployment: `ecosystem.config.js` (PM2) manages `sow-frontend` (Next.js) and `sow-backend` (uvicorn). Logs under `/root/.pm2/logs` and `/root/the11/logs`.
  - Data: MySQL schema in `database/schema.sql` (see `DEV_SETUP.md` for local DB setup).

- Developer workflows & commands (exact)
  - Local dev (quick):
    - ./dev.sh (starts backend, frontend as documented in `DEV_SETUP.md`)
    - Frontend dev: `cd frontend && pnpm dev`
    - Backend dev (PDF service): `cd backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
  - PM2 production ops (examples in docs):
    - Start via ecosystem: `pm2 start ecosystem.config.js`
    - Restart with env: `pm2 restart sow-frontend --update-env`
    - Make persistent on reboot: run `pm2 startup` then `pm2 save` (or use Easypanel proxy as described in `DOMAIN-SETUP-GUIDE.md`).

- Key patterns & gotchas (refer to these files)
  - PDF export flow: frontend route `frontend/app/api/generate-pdf/route.ts` forwards requests to the PDF service (env var `NEXT_PUBLIC_PDF_SERVICE_URL`, default `http://localhost:8000`). Backend handler is `backend/main.py`.
    - Common failure modes: frontend returns 500 when fetch to the PDF service times out or the service raises an exception. Check backend logs (`/root/the11/logs/backend-*.log`) and FastAPI stdout for stack traces.
    - Timeout: frontend uses a 30s AbortController. If heavy HTML or external fonts/images slow WeasyPrint, increase timeout or make PDF generation asynchronous (queued worker) and return a job id.
  - Rich content: SOW content is stored as TipTap JSON and converted to HTML with `generateHTML(content, defaultExtensions)` (see `frontend/app/portal/sow/[id]/page.tsx` and `@/components/tailwind/extensions`). When changing editor nodes, update this conversion code and the WeasyPrint-safe CSS in `backend/main.py`.
  - Styling for PDF: `backend/main.py` embeds `DEFAULT_CSS`. Avoid runtime client-only CSS features (variables, remote fonts that block rendering) — prefer embedding critical styles.

- Integration points & external deps
  - AnythingLLM / OpenRouter: used for AI suggestions. See `frontend` imports for `anythingllm` and `OpenRouter` comments. API keys and endpoints are in `DEV_SETUP.md` and environment variables.
  - MySQL: ensure DB user and schema exist before running migrations (see `DEV_SETUP.md` and `database/schema.sql`).
  - PM2 / Easypanel: production uses `pm2` (ecosystem.config.js). Easypanel handles proxying/SSL in production; `DOMAIN-SETUP-GUIDE.md` documents this.

- Debugging tips (concrete)
  - PDF 500: reproduce with curl/postman to `http://localhost:8000/generate-pdf` using the same payload logged by the frontend. Inspect backend console output — `backend/main.py` prints first 500 chars of HTML before rendering.
  - Frontend -> PDF 500 with message `fetch failed`: check `NEXT_PUBLIC_PDF_SERVICE_URL` (frontend env) and network, or PM2 process `sow-backend` status and logs.
  - SSH disconnects/resource issues: server frequently sees brute-force SSH attempts (check `journalctl -u sshd`). Look for heavy processes (`ps aux --sort=-%mem`) — VSCode remote server processes and Node/queue workers are common memory users.

- Quick examples to mention in PRs
  - When modifying TipTap nodes, include a unit test or a manual conversion check: run the same `generateHTML` call in a Node script and render via the backend to verify WeasyPrint doesn't error on new HTML nodes.
  - When changing PDF CSS, run the FastAPI locally and request a small sample HTML to ensure WeasyPrint output doesn't crash (use `uvicorn main:app --reload`).

- Where to look first (file pointers)
  - `frontend/app/portal/sow/[id]/page.tsx` — SOW load, TipTap -> HTML conversion, PDF trigger UI
  - `frontend/app/api/generate-pdf/route.ts` — forwarding/timeout logic and `NEXT_PUBLIC_PDF_SERVICE_URL` usage
  - `backend/main.py` — WeasyPrint usage, CSS template, and detailed debug prints
  - `ecosystem.config.js` — PM2 process names and runtime args
  - `DEV_SETUP.md`, `DOMAIN-SETUP-GUIDE.md` — exact dev/prod commands, environment details, Easypanel notes

If anything here is unclear or you'd like additional examples (e.g., a small test harness for PDF generation or a systemd unit for PM2), tell me which one to add and I will update this file.
