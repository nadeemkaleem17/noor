# noor mock-api

A small Express server that serves the Noor store API shape with **in-memory** data,
seeded from the admin panel's contract fixtures. It's meant for demos and for wiring up
the admin panel and storefront before a real backend exists.

> **Everything is lost on restart:** product edits, settings changes and uploaded images all
> reset to the seed data. There is no database.

## Run locally

Requires Node 22.9+.

**Everything at once** (API + admin + storefront, already connected), from the repo root:

```bash
npm run dev
```

That serves the API on http://localhost:3000, the admin on http://localhost:5173 and the storefront on
http://localhost:5174. Ctrl+C stops all three. It needs three gitignored files (create them once):

| File | Contents |
|---|---|
| `mock-api/.env` | `ADMIN_KEY=dev-key` |
| `admin-panel/.env.local` | `VITE_API_URL=http://localhost:3000` and `VITE_ADMIN_KEY=dev-key` |
| `ecommerce-website/.env.local` | `VITE_API_URL=http://localhost:3000` |

**Just the API:**

```bash
cd mock-api
npm install      # first time only
npm start        # reads ADMIN_KEY / PORT from mock-api/.env if present
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
| PUT | `/api/admin/settings` | Full `Settings` object (title, logo, favicon, announcement, hero slides, promo, editorial, footer) |
| POST | `/api/public/orders` | Storefront checkout. Checks each line's price and stock against the catalog (409 with a readable reason if not), then decrements stock |
| GET | `/api/public/orders/:orderNo?phone=` | Order tracking; the order number **and** phone must match (404 otherwise) |
| GET | `/api/admin/products` | Every product, including drafts |
| GET / POST / PUT / DELETE | `/api/admin/categories[/:id]` | Category CRUD |
| GET / PUT | `/api/admin/orders[/:id]` | Orders for the admin; PUT stores status changes, dispatch details and notes |
| POST | `/api/admin/reset` | Back to the seed data (uploads are kept) |
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

[`render.yaml`](../render.yaml) at the repo root is a Render Blueprint that creates three services:

| Service | Type | Root dir | Build | Serves |
|---|---|---|---|---|
| `noor-mock-api` | Web service (Node, free) | `mock-api` | `npm ci` → `npm start` | this API |
| `noor-storefront` | Static site | `ecommerce-website` | `npm ci && npm run build` | `dist/` |
| `noor-admin` | Static site | `admin-panel` | `npm ci && npm run build` | `dist/` |

Render sets `PORT` itself. The Blueprint generates a random `ADMIN_KEY` and copies it into the admin
site's `VITE_ADMIN_KEY`. Both static sites rewrite `/*` to `/index.html` so deep links survive a
refresh. All three pin `NODE_VERSION=22` (Vite 8 needs Node 20.19+).

### Steps

1. **Push the repo to GitHub.** On github.com click **+ → New repository**, name it `noor`, leave
   every "Initialize" box unticked, then from the repo root:
   `git remote add origin https://github.com/<you>/noor.git` and `git push -u origin master`.
2. In [dashboard.render.com](https://dashboard.render.com) click **New + → Blueprint**.
3. **Connect GitHub** if asked and give Render access to the `noor` repo.
4. Pick `noor`, branch `master`, Blueprint path `render.yaml`, and name the Blueprint (e.g. `noor`).
5. Render asks for the values marked `sync: false`. For **both** `VITE_API_URL` fields enter
   `https://noor-mock-api.onrender.com`. Click **Apply**.
6. Wait for `noor-mock-api` to show **Live** and open its URL: the status page should list 5 products.
7. Open `noor-storefront`'s URL: the header should read "Noor & Co." and the home page should show the
   hero slides. Open a product and refresh the page to confirm deep links work.
8. **If Render gave the API a different URL** (it adds a suffix when a name is taken, e.g.
   `noor-mock-api-x7k2.onrender.com`): open **noor-storefront → Environment**, fix `VITE_API_URL`,
   click **Save, rebuild, and deploy**, then do the same on **noor-admin**.
9. To use the admin endpoints with curl, copy the key from **noor-mock-api → Environment → ADMIN_KEY**
   (eye icon).

Without the Blueprint: create the API with **New + → Web Service** (root `mock-api`, build `npm ci`,
start `npm start`, health check `/health`, env `ADMIN_KEY` + `NODE_VERSION=22`), and each frontend with
**New + → Static Site** (root, build and publish dir as in the table, env as in `render.yaml`), then add
a **Redirects/Rewrites** rule `/*` → `/index.html` (Action: Rewrite) on each static site.

### Frontend environment variables

| Variable | App | Local (`.env.local` in the app folder) | On Render |
|---|---|---|---|
| `VITE_API_URL` | storefront + admin | `http://localhost:3000` | the API's `https://….onrender.com` URL |
| `VITE_ADMIN_KEY` | admin only | the `ADMIN_KEY` you started this server with | filled from the API by the Blueprint |

Vite bakes `VITE_*` values into the JavaScript at build time: restart `npm run dev` after editing
`.env.local`, and redeploy the static site after changing them on Render. Leave `VITE_API_URL` unset
to run a frontend on its built-in sample data.

> The admin panel does not read these variables yet (its API client is still to be written). Until it
> does, the deployed admin site stores everything in each visitor's browser.

### Things to know

- **Free web services sleep** after ~15 minutes idle and take ~30–60 s to wake. The storefront waits up
  to 20 s for the API; after a longer cold start it shows sample products with a "Try again" banner.
- **Every wake-up resets the data** to the seed: product edits, settings and uploads are lost.
- **`VITE_ADMIN_KEY` is public.** Anyone who loads the admin site can read it from the bundle and write
  to this API. Fine for a demo whose data resets; don't reuse the pattern with a real backend. To keep
  the admin private, delete the `noor-admin` service from `render.yaml` and run it locally instead.
- Uploaded image URLs are built from the request host (`trust proxy` is on, so they are `https`). Set
  `PUBLIC_URL` only if you put the API behind a custom domain.
