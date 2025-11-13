<!--
Comprehensive, up-to-date technical overview for the project.
This file is intended to replace older scattered MDs with a single
source-of-truth. Keep this doc versioned and update with major changes.
-->

# Technical Overview

Last updated: 2025-11-12

Purpose: provide engineers, new contributors, and stakeholders with a
concise yet thorough understanding of the project's architecture,
components, operational model, and developer workflows. This is an
authoritative document — update it when architecture, infra, or processes
change.

--

**Project Summary**
- **Name:** the11-dev (repository root: `the11-dev`)
- **Primary goal:** Provide an extensible AI/agent orchestration and
  dashboard platform that supports multi-agent workflows, observability,
  and integration with Easypanel for builds and deployments.
- **Scope:** Frontend UX (dashboard), backend services (API, agent runners),
  data extraction and processing pipelines, integrations (auth, storage,
  third-party LLMs), and operational tooling (CI/CD, monitoring).

**High-level goals & non-goals**
- Goal: Maintainable modular architecture enabling rapid feature
  development and safe deployments via Easypanel.
- Goal: Observability-first — tracing, metrics, structured logs.
- Non-goal: On-prem-only deployments — cloud-first with optional VPS
  targets supported via scripts.

--

**High-Level Architecture**

The system splits into three logical layers:

- **Presentation Layer (Frontend)**: React/TypeScript dashboard for users.
- **Application Layer (Backend)**: REST/GraphQL APIs, job runners, agent
  orchestration, business logic.
- **Platform Layer (Infra & Integrations)**: Databases, caching, message
  queue, object storage, third-party LLM providers, authentication, and
  infrastructure provisioning.

ASCII diagram (simplified):

  [User Browser]
        |
   [Frontend (React, Next.js?)]
        |
   [API Gateway / Backend Service] --- [Agent Runner(s)]
        |                                 |
   [Relational DB]  [Redis Cache]     [Message Queue]
        |              |                   |
   [Object Storage]  [Metrics/Tracing (Prom/Loki/Jaeger)]

Include components and interactions below.

--

**Components & Responsibilities**

- **Frontend (Dashboard)**
  - Tech: React + TypeScript, component library, CSS-in-JS or Tailwind.
  - Responsibilities: user-facing workflows, session management, data
    visualization, and integrations (file upload, settings).
  - Branch policy: frontend changes must be pushed to `enterprise-grade-ux`.

- **Backend API Service(s)**
  - Tech: Node.js/TypeScript or Python (repo contains both patterns —
    prefer the primary backend language in code). Provide REST endpoints
    for frontend and external integrations.
  - Responsibilities: authentication, authorization, data access, business
    logic, orchestrating agent runs, validating and sanitizing inputs.
  - Branch policy: backend changes should be merged to `deb-backend`.

- **Agent Runner(s)**
  - Runs scheduled or on-demand agent workflows.
  - Executes external LLM calls, chains prompts, handles retries and
    fallback logic.

- **Persistence**
  - Primary data store: relational DB (Postgres preferred).
  - Cache: Redis for sessions, rate limits, short-lived state.
  - Object storage: S3-compatible store for attachments and large blobs.

- **Infrastructure & Platform**
  - Message queue (e.g., RabbitMQ, SQS) for decoupling tasks.
  - Observability: Prometheus for metrics, Loki for logs, Jaeger for traces
    (or hosted equivalents).
  - Secrets: Vault, or environment-based secret management.

--

**Data Flows & Key Sequences**

- User action -> Frontend -> API -> Persist -> Queue task -> Agent Runner
  -> External LLM -> Result written -> Event emitted -> Frontend updates.

- Example: User initiates budget extraction
  1. Frontend POST `/jobs` with document ID + parameters.
  2. Backend validates, writes job record to DB, and publishes job to
     the queue.
  3. Agent Runner consumes job, downloads document from object store,
     calls LLM, performs parsing, writes results to DB, emits completion
     event.
  4. Backend marks job complete; frontend listens via WebSocket/polling
     and updates UI.

--

**APIs & Contracts**

- Use explicit OpenAPI or GraphQL schema files. Wherever possible, keep
  payloads small and paginated. Version APIs with path or header.
- Typical endpoints:
  - `POST /api/v1/jobs` — create job
  - `GET /api/v1/jobs/:id` — job status
  - `GET /api/v1/agents/:id/logs` — agent run logs
  - `POST /api/v1/auth/login` — auth

Include OpenAPI spec generation in CI for sanity checks.

--

**Deployment Topology & Environments**

- Environments: `development`, `staging`, `production`.
- Builds and deployments: MUST follow the repository's Easypanel rules.
  - Per `easyp.instructions.md`: NEVER build projects locally. ALL builds
    must be done through Easypanel.
  - Branch strategy:
    - Frontend: push to `enterprise-grade-ux`.
    - Backend: push to `deb-backend`.
  - Post-push step: after every push, run `/root/the11-dev/cleanup-vps.sh`.

- Typical infra pattern:
  - Kubernetes or container-based orchestration for backend + runners.
  - Load balancer / API gateway in front of services.
  - Managed DB and object storage for production.

--

**CI/CD**

- Pipeline stages (common): lint -> unit test -> build -> static analysis ->
  integration tests -> publish artifact -> deploy to staging -> manual
  approval -> deploy to production.
- Keep build artifacts immutable and signed.
- Include security scanning (SCA) and container image scanning.

Note: Per project rules, CI should delegate build steps to Easypanel where
applicable.

--

**Testing Strategy**

- Unit tests: pure functions, controller logic. Fast, run on every push.
- Integration tests: database interaction, API contracts, queueing flows.
- End-to-end tests: full UI flows against a staging environment (run in
  Easypanel or dedicated test cluster).
- Test data: use deterministic fixtures and a local test database for
  integration tests when allowed. Avoid seeding production data.

Testing responsibilities:
- Developers: write unit and integration tests for new features.
- CI: run test suites and block merges on failing critical tests.

--

**Security**

- Authentication: OAuth2/JWT for API access with short-lived tokens.
- Authorization: RBAC checks in backend services.
- Secrets: do not store secrets in repo. Use environment secret manager or
  an approved secret store. Rotate keys regularly.
- Network: restrict database and internal services to private networks.
- Input validation and sanitization on all API entry points.

Run periodic security audits and dependabot/SCA alerts.

--

**Observability & Incident Response**

- Metrics: instrument critical paths, QPS, latency percentiles, error
  rates. Export to Prometheus-compatible system.
- Logs: structured JSON logs with trace IDs. Centralize in Loki/ELK.
- Tracing: pass trace IDs through request flows and agent runners
  (Jaeger). Correlate traces with logs and metrics for debugging.
- Alerts: SLO-driven alerts (latency, error budget) and on-call runbooks.

--

**Performance & Scaling**

- Design for horizontal scaling: make services stateless where feasible.
- Use Redis for caching hot reads and rate-limiting.
- Agent runners: scale with queue length and implement backpressure.
- Cache invalidation strategy should be explicit and safe.

--

**Developer Setup & Local Workflow**

- Clone repo: `git clone <repo-url> && cd the11-dev`.
- Branching: create feature branches off the appropriate main branch
  (frontend -> `enterprise-grade-ux`, backend -> `deb-backend`).
- Builds: do not perform full production builds locally — follow Easypanel
  workflow for build/deploy. You may run linters and unit tests locally.
- Local services: where allowed, run dependent services via `docker-compose`
  or test containers. Do not mimic production infra exactly locally.

Recommended commands (examples):
```
# install deps (language-specific)
npm install
# run linters
npm run lint
# run unit tests
npm test
```

--

**Contribution Guidelines**

- Open a PR against the appropriate branch.
- Ensure tests and linters pass; include changelog entries for user-impacting
  changes.
- Small features: single PR. Large changes: create RFC and get architecture
  sign-off.

--

**Operational Playbook (short)**

- Common commands:
  - Check running services: (depends on infra) `kubectl get pods` or
    cloud console.
  - Tail logs: `kubectl logs -f <pod>` or `stern`.
- Incident triage: identify impacted services, find recent deploys, check
  queue/backlog, and roll back if needed.

--

**Glossary**

- Agent Runner: process that executes multi-step LLM or agent workflows.
- Easypanel: the project's sanctioned build & deploy platform (see
  `easyp.instructions.md` in user config).
- SLO: service-level objective.

--

**Where to update this doc**

- Keep this file at `/root/the11-dev/TECHNICAL-OVERVIEW.md`.
- For API schema changes, update the OpenAPI files and reference them here.
- For infra changes, update the 'Deployment Topology' and the 'Operational
  Playbook' sections.

--

**Next steps / Recommendations**

1. Convert architecture ASCII diagram into an actual diagram (Mermaid or
   draw.io) and store under `docs/diagrams/`.
2. Add OpenAPI/GraphQL schema files to `api/` and reference them here.
3. Add a short runbook per common incident in `docs/runbooks/`.

--

If you'd like, I can:
- Generate a Mermaid diagram and add it to `docs/diagrams`.
- Create a checklist for PR reviewers to verify observability/security.

Contact: engineering@the11.example (update to real team contact).
