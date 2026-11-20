# Set up bCloud AI Search for BigCommerce

From zero to a working app on a BigCommerce store: admin pages inside the control panel, catalogue
sync, and the storefront (AI search, suggestions, assistant, widgets, tracking).

## What you need

| Item | Where it comes from | Used for |
|---|---|---|
| A BigCommerce **Developer Portal** account | devtools.bigcommerce.com (same login as the store) | Creating the app: **Client ID** and **Client secret** |
| A BigCommerce store with a **Stencil** theme (e.g. Cornerstone) | Your dev or sandbox store | Installing and testing |
| An https host for this app | Railway (Dockerfile included) or any Node 20+ host | `APP_URL` |
| The store's bCloud login: **client ID**, **dashboard password**, **product API key** | bCloud's welcome document | The Connect page in the app |

A **store API account token** (Settings > API > Store-level API accounts) is **not** used by this app.
BigCommerce gives the app its own token for each store when the store installs it. You can keep the
store token for checking things by hand (for example `GET /v3/content/scripts`), but never put it in
the app's settings.

## 0. Run on your computer first (optional)

BigCommerce only opens apps over https, so a local run needs a tunnel to your computer.

1. Node 22.12 or newer, then `npm install` in the project folder.
2. Start a tunnel in a second terminal and keep it open:
   `cloudflared tunnel --url http://localhost:3000` (Windows: `winget install --id Cloudflare.cloudflared`;
   Mac: `brew install cloudflared`). It prints an address like `https://xxxx.trycloudflare.com`: that is `APP_URL`.
   A new tunnel gets a new address: then update `APP_URL`, the 4 callback URLs (section 2) and press
   **Update** on the Storefront page.
3. Copy `.env.example` to `.env` and fill it in as in section 3, with `DATABASE_URL="file:dev.sqlite"`.
   Secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. `npm run setup` (local database), then `npm run dev:local` (reads `.env`, port 3000).
5. Continue with sections 2, 4 to 9, using the tunnel address as `APP_URL`.

`npm run dev` alone does not read `.env`; use `dev:local` (or `npm run build` then `start:local`).

## 1. Host the app

1. Create a Railway service from this folder (it has a `Dockerfile`).
2. Add a volume mounted at `/data`.
3. Generate a public domain. This is `APP_URL`, for example `https://bcloud-bc.up.railway.app` (https,
   no trailing slash).

## 2. Create the app in the Developer Portal

1. devtools.bigcommerce.com > **My Apps** > **Create an app**, name it "bCloud AI Search".
2. **Technical** tab, callback URLs:
   * Auth Callback URL: `{APP_URL}/auth`
   * Load Callback URL: `{APP_URL}/load`
   * Uninstall Callback URL: `{APP_URL}/uninstall`
   * Remove User Callback URL: `{APP_URL}/remove_user`
3. **Multiple Users**: on.
4. **OAuth scopes**:
   * Products: **read-only**
   * Information & Settings: **read-only**
   * Content: **modify** (storefront scripts, the AI search page, Page Builder widgets)
   * everything else: none
5. Save, then **View Client ID**: copy the Client ID and Client secret.

## 3. Variables (Railway > Variables)

| Variable | Value |
|---|---|
| `BC_CLIENT_ID` | Client ID from step 2 |
| `BC_CLIENT_SECRET` | Client secret from step 2 |
| `APP_URL` | The https address from step 1 |
| `SESSION_SECRET` | `openssl rand -base64 32` (not the same as the client secret) |
| `BCLOUD_ENCRYPTION_KEY` | `openssl rand -base64 32` (keep it; changing it makes saved logins unreadable) |
| `DATABASE_URL` | `file:/data/prod.sqlite` |
| `PORTAL_DATA_SOURCE` | `api` |
| `BCLOUD_API_BASE_URL` | `https://search.bcloudai.com` |
| `BCLOUD_ACCESS_REQUESTS` | `off` (or `on` with `BCLOUD_PARTNER_KEY`, see `access-request-api.md`) |

Deploy. Migrations run on start. Open `{APP_URL}/storefront/bcloud.js` in a browser: it must load
(the storefront loads its JavaScript from there).

## 4. Install on the store

1. In the store's control panel: **Apps > My Draft Apps** > bCloud AI Search > **Install**
   (or Developer Portal > your app > install on a store).
2. Approve the scopes. The app opens on **Connect bCloud**.

A store that installed an earlier version (without Content: modify) must approve the new scope:
**Apps > My Apps** > bCloud AI Search > approve the update. If BigCommerce does not ask, uninstall
and install again.

## 5. Connect bCloud

1. Enter the bCloud **client ID**, **dashboard password** and **product API key**, then **Connect**.
2. The first full sync starts by itself (visible products only). Check **Data sync**.

## 6. Turn on the storefront

1. **Storefront** page > **Turn on**. The app makes:
   * 4 scripts in **Storefront > Script Manager** (names start with "bCloud AI Search")
   * a hidden page **Search** at `/bcloud-search/` (not in menus)
   * 6 widgets in Page Builder > **Custom**
2. Open the storefront: the search box shows AI suggestions, searches open `/bcloud-search/`, and the
   Ask AI button appears if the assistant is on.
3. If the suggestions do not open under your theme's search box, change **Search box (CSS selector)**
   on the Storefront page and press **Save selectors**.

## 7. Place widgets (Page Builder)

1. **Storefront > My Themes > Customize**.
2. Pick a page (Home page; a product page for Similar products).
3. Widget list > **Custom** > drag a bCloud widget onto the page > **Publish**.
4. The widget fills on the live storefront (Page Builder's own preview may stay empty).

## 8. Design

**Storefront design**: layouts, texts, colours and on/off for every feature, with a live preview.
**Save** writes them into the main script; the storefront shows them on the next page load.

## 9. Tracking

On by default with the storefront. Purchases need **Optimized One-Page Checkout** (Settings >
Checkout). With the cookie consent banner on (Settings > Security & Privacy), tracking runs only for
shoppers who allow analytics, and recent searches only for shoppers who allow functional cookies.

## 10. Check on the dev store (items marked REQUIRES VERIFICATION)

| Check | How | If it fails |
|---|---|---|
| Purchases arrive | Place a test order, then see **Live activity** / Analytics for purchase events | Order id not filled by Handlebars: the script falls back to the address; report the confirmation page URL |
| Widgets listed | Page Builder > Custom shows 6 "bCloud …" widgets | Report it; the templates are in `GET /v3/content/widget-templates` |
| Similar products | Product page with the widget shows products | Theme without `.productView[data-entity-id]`: report the theme name |
| Search page | `/bcloud-search/?q=test` shows results | Another page uses that address: the Storefront page says so |
| No console errors | Browser console on the storefront | A Content Security Policy may block `APP_URL`: allow it in the store's CSP |

## Uninstall

BigCommerce removes the app's scripts by itself. The hidden **Search** page (Storefront > Web
Pages) and the Page Builder widget templates stay; delete them by hand if wanted. The app deletes
the store's token, users and bCloud login from its database.
