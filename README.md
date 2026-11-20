# bCloud AI Search for BigCommerce

The bCloud client portal inside the BigCommerce control panel, over the live bCloud AI Search
service. Same pages, design and bCloud features as the bCloud Shopify app.

* Step-by-step set up (Developer Portal, hosting, install, storefront): [`docs/bigcommerce-setup.md`](docs/bigcommerce-setup.md)
* Architecture, APIs, security and limitations: [`docs/bigcommerce-app.md`](docs/bigcommerce-app.md)
* Portal pages and the bCloud API map: [`docs/portal-architecture.md`](docs/portal-architecture.md)
* Request access contract (needs bCloud): [`docs/access-request-api.md`](docs/access-request-api.md)

## Set up

1. **Hosting.** Deploy this folder as its own Railway service (Dockerfile included), with a volume
   mounted at `/data`. Note its public address, e.g. `https://bcloud-bc.up.railway.app`.
2. **Developer Portal** (devtools.bigcommerce.com > My Apps > Create an app):
   * Auth Callback URL: `{APP_URL}/auth`
   * Load Callback URL: `{APP_URL}/load`
   * Uninstall Callback URL: `{APP_URL}/uninstall`
   * Remove User Callback URL: `{APP_URL}/remove_user`
   * OAuth scopes: **Products: read-only**, **Information & Settings: read-only**, **Content: modify**
   * Multiple users: on (the app keeps a list of users and honours Remove user)
3. **Variables** (Railway > Variables), see `.env.example`:
   `BC_CLIENT_ID`, `BC_CLIENT_SECRET`, `APP_URL`, `SESSION_SECRET` (`openssl rand -base64 32`),
   `DATABASE_URL=file:/data/prod.sqlite`, `BCLOUD_ENCRYPTION_KEY` (`openssl rand -base64 32`),
   `PORTAL_DATA_SOURCE=api`, `BCLOUD_API_BASE_URL=https://search.bcloudai.com`.
4. **Install** on a BigCommerce sandbox store: Developer Portal > your app > install on a store
   (or the store's Apps > My Draft Apps). The app opens on **Connect bCloud**.
5. **Storefront** page > **Turn on**, then add the bCloud widgets in Page Builder > Custom.

Database migrations run on start (`npm run docker-start`).

## Develop

```bash
npm install
cp .env.example .env          # fill in the values
npx prisma migrate deploy
npm run setup                 # local database
npm run dev:local             # reads .env; BigCommerce needs an https tunnel to APP_URL (docs/bigcommerce-setup.md, section 0)
npm run build:storefront      # after changing storefront/
npm run typecheck && npm run lint && npm run build
```
