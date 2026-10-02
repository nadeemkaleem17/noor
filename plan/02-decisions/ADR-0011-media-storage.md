# ADR-0011 — S3-compatible object storage and on-the-fly image transforms

| Field | Value |
|---|---|
| ID | ADR-0011 |
| Title | Media storage and image pipeline |
| Status | Proposed |
| Owner | Tech lead |
| Last updated | 2026-10-02 |
| Depends on | DOC-01 (F-17), ADR-0009, ADR-0019, README A-02 |
| Decisions used | ADR-0005 |

## Purpose and scope
Where uploaded media lives, how variants (sizes/formats) are produced and served. Upload endpoint contract is DOC-10 media.

## Context
Uploads are held in a `Map` capped at 200 and lost on restart (`server.js:17-19,198`); MIME type is trusted from the client header (`:182-185`). The admin resizes in the browser (`db.js:345-349`). Product photography is the main weight of a fashion page; customers are on mobile data.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| A. S3-compatible bucket + transform proxy (imgproxy-style or CDN transform) | Standard, durable; modern formats on demand | Needs a transform service or CDN feature |
| B. Pre-generate fixed sizes at upload (worker with sharp) | Predictable cost, no runtime service | Many files; new breakpoints need a backfill |
| C. Database/BYTEA or local disk | Simple | Not durable/scalable; blocks horizontal scaling |

## Decision
**Option A with B as the fallback.** Originals go to a private S3-compatible bucket (provider chosen in ADR-0019). Delivery URLs are `https://img.<domain>/<signature>/<w>x<h>/<format>/<key>`; the transform layer emits AVIF/WebP with JPEG fallback, widths from a fixed allow-list (320, 480, 640, 828, 1080, 1600). If no transform service is available at launch, a worker pre-generates those widths in WebP + JPEG on upload.
- Upload flow: admin requests a pre-signed `PUT` (`POST /api/v1/admin/media/uploads`), uploads directly, then confirms; the server **sniffs magic bytes**, rejects anything but JPEG/PNG/WebP/AVIF, caps 10 MB and 8000 px per side, strips EXIF (location data), records `width`, `height`, `blurhash`/`lqip`.
- `Media` records carry `alt` (required for publish; localizable, ADR-0018).
- Responses use immutable cache headers (`public, max-age=31536000, immutable`) with content-hashed keys.

## Examples
`<img src=".../w640/webp/…" srcset="… 320w, … 640w, … 1080w" sizes="(min-width: 768px) 25vw, 50vw" width="800" height="1000" loading="lazy" alt="…">` — width/height always present to avoid layout shift.

## Consequences
Durable media, smaller bytes, safe uploads. Adds a storage account and a transform component to operate.

## Rules
**Always:** store the original untouched; serve via signed transform URLs. **Never:** trust `Content-Type` or filename; serve user uploads from the API origin; ship an unsized `<img>`. **Common mistake:** loading the original 4000 px file on the PLP.

## Acceptance checklist
- [ ] A renamed `.exe` with an image MIME is rejected.
- [ ] Uploaded image still resolves after an API redeploy.
- [ ] PLP images over 100 kB each fail the DOC-13 budget test.

## Revisit trigger
Monthly egress or storage cost over the A-02 budget share, or transform p95 over 400 ms on cache miss.

## Open questions and assumptions
Provider options (R2/S3/Backblaze/local-region) depend on whether the business can pay in USD (A-02, CQ-2). Transform service choice is deferred to DOC-14.

## Changelog
| Date | Change |
|---|---|
| 2026-10-02 | Proposed |
| 2026-10-02 | Phase 4: transform service is imgproxy with its native signed URL format (replaces the illustrative path); URLs are built by the API; width allow-list unchanged (DOC-08 §11) |
