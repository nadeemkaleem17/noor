# noor mock-api

A small Express server that serves the Noor store API shape with **in-memory** data,
seeded from the admin panel's contract fixtures. It's meant for demos and for wiring up
the admin panel and storefront before a real backend exists.

> **Everything is lost on restart:** product edits, settings changes and uploaded images all
> reset to the seed data. There is no database.

## Run locally

Requires Node 20.11+.

```bash
cd mock-api
npm install
ADMIN_KEY=dev-key npm start      # PowerShell: $env:ADMIN_KEY="dev-key"; npm start
```

Open http://localhost:3000 to see the status page (live product count, site title, hero
slides and raw JSON). `npm run dev` restarts the server on file changes.

| Env var      | Required | Default | Purpose |
|--------------|----------|---------|---------|
| `ADMIN_KEY`  | for admin routes | — | Value clients must send in the `x-admin-key` header. If unset, every `/api/admin/*` request returns `503`. |
| `PORT`       | no | `3000` | Listen port (Render sets it for you). |
| `PUBLIC_URL` | no | request host | Base for upload URLs, e.g. `https://noor-mock-api.onrender.com`. |

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Status page |
| GET | `/health` | `{ ok, uptimeSec, counts }` |
| GET | `/api/public/products` | Active products only |
| GET | `/api/public/products/:id` | By id **or** handle; 404 if missing/not active |
| GET | `/api/public/categories` | |
| GET | `/api/public/settings` | Hero slides sorted by `sortOrder` |
| POST | `/api/admin/products` | Full `Product`; `id` optional (generated). 409 on duplicate id/handle |
| PUT | `/api/admin/products/:id` | Full replace; URL id wins. 404 / 409 |
| DELETE | `/api/admin/products/:id` | 204 / 404 |
| PUT | `/api/admin/settings` | Full `Settings` object |
| POST | `/api/admin/uploads` | Multipart field `file`; JPEG/PNG/WebP/GIF/AVIF, max 2 MB. Returns `{ url }` served from `/uploads/…` (last 50 kept) |

Admin routes return `401` without a valid `x-admin-key`. Request bodies are validated with zod
([schemas.js](schemas.js), copied from `admin-panel/src/contract/schemas.js`). A `400` response
includes zod's `issues` array.

**Settings shape** (new; not in the contract yet):

```js
{ siteTitle, logoUrl, faviconUrl,
  heroSlides: [{ imageUrl, heading, subheading, buttonText, buttonLink, sortOrder }] }
```

## curl examples

```bash
B=http://localhost:3000
K="x-admin-key: dev-key"

curl $B/health
curl $B/api/public/products
curl $B/api/public/products/sana-khussa
curl $B/api/public/categories
curl $B/api/public/settings

# Create a product (id is generated when omitted)
curl -X POST $B/api/admin/products -H "$K" -H "Content-Type: application/json" -d '{
  "handle":"test-shawl","status":"active","kind":"accessory","title":"Test Shawl",
  "primaryCategoryId":"cat_accessories","categoryIds":["cat_accessories"],"collectionIds":[],
  "attributes":{},"options":[],
  "variants":[{"id":"v1","sku":"SHW-1","optionValueIds":[],"price":{"amount":250000,"currency":"PKR"},"stock":{"status":"in_stock","quantity":5}}],
  "media":[{"id":"m1","type":"image","url":"https://picsum.photos/seed/shawl/900/1200","alt":"Shawl","width":900,"height":1200}]}'

# Replace / delete it (use the id returned above)
curl -X PUT    $B/api/admin/products/<id> -H "$K" -H "Content-Type: application/json" -d '{ ...full product... }'
curl -X DELETE $B/api/admin/products/<id> -H "$K"

# Update settings
curl -X PUT $B/api/admin/settings -H "$K" -H "Content-Type: application/json" -d '{
  "siteTitle":"Noor & Co.","logoUrl":"","faviconUrl":"",
  "heroSlides":[{"imageUrl":"https://picsum.photos/seed/hero-1/1600/700","heading":"Festive Edit",
    "subheading":"New lawn","buttonText":"Shop now","buttonLink":"/collections/festive","sortOrder":0}]}'

# Upload an image
curl -X POST $B/api/admin/uploads -H "$K" -F "file=@./photo.jpg"
```

Prices are `Money` in minor units: `{"amount": 699000, "currency": "PKR"}` means Rs. 6,990.

## Deploy to Render

1. Push the `noor` repo to GitHub.
2. In Render, choose **New → Web Service** and pick the repo.
3. Set **Root Directory** to `mock-api`, **Build Command** to `npm install`, and **Start Command** to `npm start`.
4. Under **Environment**, add `ADMIN_KEY` (a long random string) and, optionally, `PUBLIC_URL`.
5. Deploy, then open `https://<service>.onrender.com/`.

On Render's free plan the service sleeps when idle and wakes back up with fresh seed data.
