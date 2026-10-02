# ADR-0019 — Single-region container host, managed MySQL, CDN

| Field | Value |
|---|---|
| ID | ADR-0019 |
| Title | Hosting baseline |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | README A-02, A-03, ADR-0004, ADR-0008, ADR-0011 |
| Decisions used | ADR-0009, ADR-0012 |

## Purpose and scope
Deployment topology and the constraints that choose a provider. Environments, CI/CD, backups and runbooks are DOC-14.

## Context
The hosting and budget inputs were blank (A-02). Today the mock runs on a Render free instance that sleeps and takes 30–60 s to wake (comments in `utils/api.js:6-9`, `lib/api.js:12`). A shop cannot cold-start. Customers are in Pakistan on mobile data; a Pakistani business may be unable to pay some foreign SaaS in USD (unverified; CQ-2).

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. Container PaaS (always-on) + managed MySQL + CDN, one region | Low ops; predictable cost | Region latency to Pakistan not guaranteed |
| B. One VPS with Docker Compose | Cheapest; full control | We own patching, backups, failover |
| C. Kubernetes/serverless | Scales | Overkill; cost and complexity |
| D. Local-region (Pakistan) hosting | Lowest latency | Provider quality/tooling unverified |

## Decision
**Option A, as an assumption pending CQ-2.** Topology: CDN → `storefront` (Node, 2 instances) and `api` (Node, 2 instances) + one `worker` process → managed MySQL 8.4 with daily backups and binlog point-in-time recovery → S3-compatible bucket. `admin` is static assets on the CDN. Region: the nearest available to Pakistan with the budget (candidates: Singapore, Mumbai, Frankfurt, Dubai-adjacent); **latency to Karachi/Lahore must be measured, not assumed** (DOC-14 task M0-07).
- Minimum two instances of `storefront` and `api` (no cold start; rolling deploys).
- Domains: `www.<domain>` (storefront), `admin.<domain>`, `api.<domain>`, `img.<domain>`.
- Budget envelope (assumption A-02): ≤ US$150/month at launch; first lever if exceeded: drop to one VPS (option B) with automated off-site backups.

## Examples
`docker-compose.yml` (local) mirrors prod services: `mysql`, `api`, `worker`, `storefront`, `mailpit` (dev email).

## Consequences
Always-on service removes cold starts. Provider choice stays reversible because everything is containers + MySQL + S3 API.

## Rules
**Always:** keep config in env vars validated at boot; make containers stateless. **Never:** deploy on a free sleeping tier; keep uploads or sessions on local disk. **Common mistake:** choosing a region by price alone.

## Acceptance checklist
- [ ] p95 TTFB from a Karachi and a Lahore mobile connection measured and recorded in DOC-14.
- [ ] Restore from backup rehearsed once before launch.
- [ ] `api` survives killing one instance without failed checkouts.

## Revisit trigger
Monthly cost over A-02, p95 TTFB over 600 ms from Pakistan, or an outage traced to single-region failure.

## Open questions and assumptions
Provider is **not chosen** here on purpose: the candidates depend on CQ-2 (budget, ability to pay in USD). No provider's pricing was researched.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Managed MySQL replaces managed Postgres |
| 2026-10-02 | Owner answer: domain `rubaya.pk`; production later (README A-08). No hosting provider is chosen yet |
| 2026-10-02 | Phase 4: provider requirements and release/backup/runbook procedures in DOC-14; provider choice is task `LAUNCH-01` |
