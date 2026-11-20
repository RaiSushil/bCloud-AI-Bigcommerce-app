# bCloud Client Portal in the BigCommerce app

The BigCommerce app shows the bCloud Client Portal inside the BigCommerce control panel (Apps >
bCloud AI Search): Analytics, Live activity, Missed searches, Products, Data sync, Billing,
Storefront, Storefront design, Install & keys, Settings and the **blu** assistant. The menu and
pages follow bCloud's client portal as updated in November 2026 (Overview and Search analytics are
one Analytics page; Integration doctor, Search settings and Support are sections of Settings; no
"What is this page?" cards). Old addresses (`/app/analytics`, `/app/search-settings`,
`/app/support`) redirect to the new places. The pages, design and bCloud calls are the same as the Shopify app's; only the
platform layer differs (see [`bigcommerce-app.md`](bigcommerce-app.md)).

Every page reads its data from the **bCloud Client Dashboard API**
(`docs/bcloud-client-dashboard-api.html`, October 2026). A static demo mode is kept for
design work and demos.

---

## 1. Run it

```bash
npm install
npx prisma migrate deploy
npm run dev            # http://localhost:3000; BigCommerce needs an https address (a tunnel) to open it
```

`.env` (copy from `.env.example`): `BC_CLIENT_ID`, `BC_CLIENT_SECRET`, `APP_URL`, `SESSION_SECRET`,
`DATABASE_URL`, `BCLOUD_ENCRYPTION_KEY` and the bCloud settings below.

| Variable | Default | Meaning |
|---|---|---|
| `PORTAL_DATA_SOURCE` | `mock` | `mock` = demo data, `api` = real bCloud API for every page |
| `PORTAL_API_SERVICES` | empty | With `mock`, switch single pages to the API, e.g. `overview,analytics` |
| `BCLOUD_API_BASE_URL` | `https://search.bcloudai.com` | bCloud base URL |
| `BCLOUD_ENCRYPTION_KEY` | (none) | **Required.** `openssl rand -base64 32`. Encrypts the BigCommerce token, the dashboard passwords and the API keys |
| `PORTAL_API_TIMEOUT_MS` | `15000` | Timeout per call |
| `BCLOUD_ACCESS_REQUESTS` | `off` | `on` shows "Request access" on the Connect page (needs bCloud's access-request API) |
| `BCLOUD_PARTNER_KEY` | (none) | Secret, server only. bCloud partner key for the access-request API (`X-Partner-Key`) |

The merchant installs the app, lands on **Connect bCloud** and enters the store's bCloud client
ID, dashboard password and product API key once. The app checks the login with
`POST /client-api/login` and the key against the same account, saves both encrypted, starts the
first product sync, and every page fills with that store's data. After that, BigCommerce's
product webhooks keep search current.

**Request access** works as in the Shopify app (bCloud's API is live: [`access-request-api.md`](access-request-api.md)),
with `platform: "bigcommerce"` and `shop_domain: "store-{hash}.mybigcommerce.com"` from the
verified session. The form is prefilled from `GET /v2/store`. Hidden until
`BCLOUD_ACCESS_REQUESTS=on` and `BCLOUD_PARTNER_KEY` are set.

---

## 2. How sign-in works

```
Merchant opens the app in the control panel
  → BigCommerce calls GET /load?signed_payload_jwt=…   (HS256, client secret, aud = client id)
  → the app sets its session cookie and redirects to /store/{hash}/app
  → route loader: cookie verified, the store in the URL must be in the session,
                  the store installed and the user not removed (database)
  → portalApi.<page>.get({ shop: storeHash })
  → http.server.ts adds  Authorization: Bearer <token>   (bCloud login per store, as in the Shopify app)
  → bCloud /client-api/...  → page
```

* **Table `BcStore`**: the store's BigCommerce access token (AES-256-GCM, bound to the store hash),
  scope and owner. **Table `BcStoreUser`**: control panel users who may open the app (removed on
  `/remove_user`). Both deleted on `/uninstall`.
* **Table `BcloudConnection`** (one row per store): the bCloud login and product API key, encrypted,
  plus the sync lock. **Table `BcloudAccessRequest`**: as in the Shopify app.
* **Session cookie** `bc_app_session`: HttpOnly, Secure, SameSite=None, Partitioned (required inside
  the control panel iframe); a JWT signed with `SESSION_SECRET` holding the user id and the stores
  opened in this browser; 10 hours, then the app is opened again from the control panel.
* Nothing secret reaches the browser: not the BigCommerce token, the password, the bCloud token or the key.

---

## 3. Folder structure

```
app/
  routes/
    auth.tsx  load.tsx  uninstall.tsx  remove_user.tsx    BigCommerce callbacks
    webhooks.catalogue.tsx       product webhooks (store header checked)
    app.tsx                      layout at /store/:storeHash/app: session check, sidebar shell
    app.*.tsx                    the portal pages (same as the Shopify app)
  routes.ts                      mounts app*.tsx under /store/:storeHash
  bigcommerce.server.ts          app settings (client id/secret, APP_URL, SESSION_SECRET), scopes

  portal/
    bigcommerce/                 the only code that talks to BigCommerce
      api.server.ts              REST client per store (token, timeout, 429 wait, safe logs)
      install.server.ts          /auth token exchange, signed payload, load, uninstall, remove user
      session.server.ts          session cookie, store-in-URL check
      jwt.server.ts              HS256 sign/verify (node:crypto)
      catalogue.server.ts        Catalog API v3 -> bCloud product mapping
      webhooks.server.ts         product webhook registration and verification
      store-info.server.ts       GET /v2/store
      storefront.server.ts       Storefront pages (phase 1: install not built yet)
      frame.server.ts            frame-ancestors header, callback message page
    api/                         ← the only code that talks to bCloud (same as the Shopify app)
    lib/router.tsx               Link / NavLink / useNavigate / useFetcher that keep /store/{hash}
    components/  pages/  lib/  styles/   UI only (props in, no fetch)

storefront/                      storefront JavaScript and CSS sources -> npm run build:storefront
public/storefront/               built storefront files (loaded by the phase 2 storefront install)
```

---

## 4. Page → endpoint map

| Page | Endpoints | Notes |
|---|---|---|
| Layout (sidebar name) | `GET /me` | |
| Analytics (`/app`) | `GET /overview`, `GET /me`, `GET /products?size=10` (catalogue picture), `GET /analytics?source=&size=50&days=` | catalogue card, radar with searching now (`live_5m`), funnel, 14-day chart, found nothing from `/overview`; door cards → `source` (`search`, `assistant`, `voice`, `image`; no card = `all`); 7d/30d/All → `days` 7/30/none; refresh 60 s |
| Live activity | `GET /events?type=&size=50` | filter → `type`; refresh every 8 s |
| Missed searches | `GET /overview` (`zero_count`, `zero_top`) + `GET /synonyms` | Connect = `POST /synonyms {add}` |
| Products | `GET /products?q=&category=&page=&size=24` | |
| Data sync | `GET /sync`, `GET /me`, `GET /live-sync`; **Full sync from BigCommerce**: `GET /fields`, `POST /fields/register`, `POST /ingest/start`, `POST /ingest/products` (X-API-Key); webhooks: `POST /ingest/product`, `POST /ingest/delete` | live sync polled every 3 s only while active; sync rules in [bigcommerce-app.md](bigcommerce-app.md) |
| Billing | `GET /billing`, `GET /live-sync` | |
| Storefront | BigCommerce Scripts, Pages and Widgets APIs (see bigcommerce-app.md section 7) | |
| Storefront design | `GET /v2/store` (store name, currency), `GET /client-api/overview` (top searches) | the preview calls `/shop/*` from the admin browser with the public site token; saved into the main Script Manager script |
| Install & keys | `GET /me` (`site_token`), `POST /shop/search?site=` (live preview) | |
| Settings | `GET /me` (account, Integration doctor), `POST /change-password {old_password, new_password}`; **Search settings**: `GET /synonyms`, `POST /synonyms {add}` / `{remove}` (max 100 pairs); **Support**: `GET /tickets`, `POST /tickets`, `POST /tickets/reply {message}` / `{resolve: true}` | refresh every 30 s while a ticket is open |
| blu | `POST /assistant {question, history}` | follow-ups as chips, `goto` as a link; refreshes the page when blu changed data |

All under `BCLOUD_API_BASE_URL/client-api`, with `Authorization: Bearer <token>` except `/login`.

---

## 4a. Storefront and catalogue sync

The catalogue sync, product webhooks, BigCommerce scopes, security rules, limitations and the
phase 2 storefront plan are in [`bigcommerce-app.md`](bigcommerce-app.md).

**API check** (Install & keys): tests every door on bCloud's integration list for the
connected store from the server (`api/services/apicheck.server.ts`) and copies a marked
plain-text list to send back to bCloud. Voice and tracking are checked from bCloud's own
records (analytics, events). Five checks use the AI; the searches count in statistics.

---

## 5. Built-in behaviour

* **Errors:** a failed page shows a card inside the layout (Try again / Connect / Paused).
  Form errors show as a toast or under the field. bCloud error bodies are never shown or logged.
* **Retries:** GET calls retry once on network errors and 502/503/504; POST never retries
  (no duplicate tickets or synonyms). `401` → sign in again once. `429` on blu → "20 questions per 10 minutes".
* **Logging:** store, endpoint, status, attempt, duration. Never headers, bodies, tokens or passwords.
* **Tenant safety:** the store comes only from the verified BigCommerce session (and the store in
  the URL must be one the session was opened for); the bCloud client comes only from that store's saved login.

---

## 6. Open questions for the bCloud developer

| # | Question | Where it shows |
|---|---|---|
| 1 | Does `POST /partner/signup` return the dashboard password, and under which field name? Then the app can save it at install and skip the Connect step. | Connect |
| 2 | What is inside `plan` in `GET /me`? We show `plan.name` if present. | Settings › Integration doctor |
| 3 | Run objects: which fields hold the AI tokens and the duration of a run? Do `/billing` runs have the same fields as `/sync` runs (`finished_at`, `indexed`, `failed`, `cost`)? | Billing and Data sync tables (AI tokens, Took) |
| 4 | Billing has no month-end forecast and no "AI tokens this month". Does the portal compute them in the browser? If so, from what? | Billing cards |
| 5 | What is the shape of `recent_days` in `GET /billing`? We currently build the 14-day chart from the runs. | Billing chart |
| 6 | The PDF report is drawn in the browser (`ReportPDF.jsx`). Can you share the reference source so we can match it? | Billing › Download PDF report (bCloud moved it there in Nov 2026; not shown in the app: NOT DOCUMENTED, no API) |
| 7 | `zero_top` has no "last searched" date. Is one available? | Missed searches |
| 8 | Is replying to a resolved ticket enough to reopen it? | Settings › Support |
| 9 | Should the app use the client's `theme` colours from `/login`? | Whole portal |

---

## 7. Static parts and placeholders

* **Logo and blu robot** are placeholders (`components/shell/BrandLogo.tsx`, `BluRobot.tsx`).
* **Demo mode** (`PORTAL_DATA_SOURCE=mock`) uses "Demo Store", a fake token and generated product art.
* **Data sync** had no reference screenshot; its layout follows the other pages.
* **Sign out** shows a note: the app is signed in through the BigCommerce control panel.
* **Download PDF report** shows "not available yet" (see question 6).
