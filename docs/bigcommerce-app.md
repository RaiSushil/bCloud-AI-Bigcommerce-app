# bCloud AI Search for BigCommerce: integration layer

The BigCommerce app is a thin, secure layer over the live bCloud AI Search service, built from the
Shopify app. bCloud does the search, AI, ranking, recommendations, tracking and analytics; the app
only installs into BigCommerce, maps each store to its bCloud client, keeps the catalogue in step and
shows the bCloud client portal inside the control panel.

Status: **phase 1** (admin app, Connect, every portal page, full sync, product webhooks, API check,
Request access) and **phase 2** (storefront install with Script Manager, the AI search page, Page
Builder widgets, shopper tracking, Storefront design saving; section 7). Step-by-step set up:
[`bigcommerce-setup.md`](bigcommerce-setup.md).

---

## 1. BigCommerce APIs used

| What | Endpoint | Auth | Documented |
|---|---|---|---|
| Install | `GET {APP_URL}/auth?code&scope&context&account_uuid` → `POST https://login.bigcommerce.com/oauth2/token` `{client_id, client_secret, code, scope, context, grant_type: "authorization_code", redirect_uri}` | client secret | DOCUMENTED |
| Open the app | `GET {APP_URL}/load?signed_payload_jwt=…` (HS256, client secret, `iss: "bc"`, `aud` = client id, `sub: "stores/{hash}"`) | signed payload | DOCUMENTED |
| Uninstall | `GET {APP_URL}/uninstall?signed_payload_jwt=…` | signed payload | DOCUMENTED |
| Remove user | `GET {APP_URL}/remove_user?signed_payload_jwt=…` | signed payload | DOCUMENTED |
| Store details | `GET /stores/{hash}/v2/store` | `X-Auth-Token`, `store_v2_information_read_only` | DOCUMENTED |
| Products | `GET /stores/{hash}/v3/catalog/products?include=variants,primary_image&include_fields=…&limit=250&page=n` (also `id:in=` for webhooks) | `X-Auth-Token`, `store_v2_products_read_only` | DOCUMENTED |
| Brands, categories | `GET /v3/catalog/brands`, `GET /v3/catalog/categories` (names for product ids) | same | DOCUMENTED (categories: BigCommerce suggests Category Trees when possible) |
| Webhooks | `GET /v3/hooks`, `POST /v3/hooks {scope, destination, is_active, headers}`, `PUT /v3/hooks/{id}` | `X-Auth-Token` | DOCUMENTED |
| Storefront scripts | `GET/POST /v3/content/scripts`, `GET/PUT/DELETE /v3/content/scripts/{uuid}` (`kind: script_tag`, one `<script>` per script, `load_method: default`, `location: footer`, `visibility`, `consent_category`, `auto_uninstall: true`, `enabled`) | `X-Auth-Token`, `store_v2_content` | DOCUMENTED |
| AI search page | `GET /v3/content/pages?id:in=…` / `?name:like=…`, `POST /v3/content/pages {name, type: "page", body, is_visible: false, url: "/bcloud-search/", channel_id: 1}`, `DELETE /v3/content/pages/{id}` | same | DOCUMENTED (`name:like` matching the body: as documented, REQUIRES VERIFICATION) |
| Page Builder widgets | `GET /v3/content/widget-templates?widget_template_kind=custom`, `POST` / `PUT /v3/content/widget-templates/{uuid}` `{name, template, schema}` (no `channel_id`) | same | DOCUMENTED |
| Storefront API (shopper's browser, same origin) | `GET /api/storefront/carts` (add to cart confirmed), `GET /api/storefront/order/{id}` (purchases) | shopper's own cookies | DOCUMENTED |

Scopes to set in the Developer Portal: **Products: read-only**, **Information & Settings: read-only**,
**Content: modify** (`store_v2_content`: Scripts, Pages, Widgets). A store that installed the app
before Content was added must approve the new scope (the Storefront page says so on a 403).

Rate limits: a `429` is waited out using `X-Rate-Limit-Time-Reset-Ms` (at most 15 s, 3 tries); GET
calls retry once on network errors and 5xx; writes never retry blindly.

## 2. bCloud APIs used

The same as the Shopify app: the Client Dashboard API (`/client-api/*`, bearer token from
`POST /client-api/login`), the Ingestion API (`/fields/register`, `/fields`, `/ingest/start`,
`/ingest/products`, `/ingest/product`, `/ingest/delete`, `/ingest/sync-status`,
`/ingest/image-signatures/*`, `X-API-Key`) and the public Shop API (`/shop/*`, site token) for the
Storefront design preview and the API check. Nothing new is asked of bCloud for phase 1, except:

* **Request access**: `POST/GET /partner/access-requests…` is live (CONFIRMED by bCloud on 22 Oct 2026;
  auto-approve on since Nov 2026: when the first answer already says `approved`, the app collects the
  keys at once with `GET …/{id}`, connects, and sends `POST …/delivered`;
  [`access-request-api.md`](access-request-api.md)). REQUIRES VERIFICATION that it accepts
  `platform: "bigcommerce"`. On when `BCLOUD_ACCESS_REQUESTS=on` and `BCLOUD_PARTNER_KEY` are set.

## 3. Tenant mapping and isolation

```
BigCommerce store (store hash, from BigCommerce only)
  → BcStore (encrypted access token)  → BcloudConnection (bCloud client id + encrypted login + key)
  → bCloud API with that client's own credentials
```

* The store hash comes only from BigCommerce: the token response's `context`, the `sub` of a payload
  signed with the client secret, or a webhook whose store-specific header matches.
* Portal URLs carry the store (`/store/{hash}/app/…`); the session cookie lists the stores this browser
  opened, so a URL for any other store is refused, and two stores open in two tabs never mix.
* One BigCommerce store per bCloud account (`clientId` is unique), because a full sync removes whatever
  the store did not send.
* The bCloud client never comes from the browser.

## 4. Catalogue sync

* **First sync** starts by itself after Connect: every product is read first (nothing in bCloud changes
  if BigCommerce cannot be read), the key is checked to belong to the connected account, then
  `/fields/register`, `/ingest/start {source_total}` (smart sync: unchanged products cost nothing,
  products not sent are removed at the end) and `/ingest/products` in batches of 5.
* **Sent**: products with `is_visible` true and `availability` not `disabled`. Hidden and disabled
  products are not sent (and removed by the webhooks or the next full sync).
* **Mapping** (same field names as the Shopify app): `id`, `name`, `description` (HTML to plain text,
  1,000 characters), `brand` (brand name), `category` (the first visible category name, as text: bCloud refuses lists), `tags`
  (`search_keywords` plus up to 4 more category names), `price` / `sale_price` (regular and lower selling price; MSRP `retail_price`
  counts as the regular price when higher), `in_stock` (per `inventory_tracking`: none, product or
  variant), `sku`, `url` (`custom_url.url`, relative), `primary_image` (`url_standard`).
* **Webhooks** (registered at install and Connect, checked once a day on open):
  `store/product/created`, `store/product/updated`, `store/product/deleted`,
  `store/product/inventory/updated`, `store/sku/inventory/updated` → re-read the product →
  `/ingest/product` or `/ingest/delete`. Events within 2 s are merged; during a full sync they wait.
* **Limit**: 50,000 products held in memory per sync (same as the Shopify app).

REQUIRES VERIFICATION on a real store: the exact `data` shape of `store/sku/inventory/updated`
(the app reads `data.product_id` or `data.inventory.product_id`; without a product id the event is
skipped and the next product change or full sync heals it).

## 5. Security

* Secrets (client secret, session secret, encryption key, partner key) live only in server
  environment variables. The BigCommerce token, bCloud password and API key are stored encrypted
  (AES-256-GCM, each bound to its store) and never logged or sent to a browser.
* Signed payloads: HS256 only (any other algorithm, including `none`, is refused), audience and
  issuer checked, 60 s clock leeway.
* Session cookie: HttpOnly, Secure, SameSite=None, Partitioned, signed with `SESSION_SECRET`,
  10 hours; every request also checks the store is installed and the user was not removed.
* Webhooks: BigCommerce does not sign callbacks; each hook carries a store-specific header
  (HMAC-SHA256 of the store hash with the client secret), compared in constant time. A forged
  call gets 401 and nothing is read.
* Framing: `Content-Security-Policy: frame-ancestors https://*.mybigcommerce.com https://*.bigcommerce.com`.
* Logs: store hash, path (ids masked), status and outcome only.
* Storefront: only the public, read-only site token, the `/shop` address, the design settings and
  the search box selectors are written into Script Manager (base64 JSON, so BigCommerce's Handlebars
  never reads it). The ingestion key, dashboard password, BigCommerce token and partner key never
  leave the server. The storefront JavaScript is served from this app (`APP_URL/storefront/*.js?v=…`).
* Consent: the main script is `essential` and sets no cookie or storage by itself. The visitor id
  cookie (`_bc_vid`), click attribution and all tracking need the `analytics` consent script to run;
  recent searches need the `functional` one; the purchase script is `analytics`. With BigCommerce's
  cookie consent banner on, BigCommerce runs those scripts only for shoppers who allow them.

## 6. Failure cases

| Case | What happens |
|---|---|
| Token exchange refused | "Install failed" page; nothing saved |
| Signed payload invalid or expired | "This link has expired" page (401) |
| Store not installed on `/load` | "Not installed" page (404) |
| Session ended or another store's URL | "Open the app again" card, no data |
| BigCommerce 401 (token revoked) / 403 (scope) | Safe message asking to reopen or approve; sync stops before touching bCloud |
| BigCommerce 429 | Waited out and retried |
| Webhook for a store without a key | Ignored with 200 |
| Product read fails during a webhook | Nothing sent for that product; the next change or full sync heals it |
| Uninstall | Store, users, bCloud login, key and request deleted; old sessions refused. BigCommerce removes the app's scripts (`auto_uninstall`); the hidden Search page and the widget templates stay (delete them in the control panel if wanted) |
| Content scope missing (403) | Storefront page and Storefront design explain how to approve the Content permission; nothing is changed |
| `/bcloud-search/` already used by another page (422) | The storefront turns on without the AI search page; searches use the theme's search page, and the page says why |
| Script over 64 KB (very long design texts) | Save refused with "shorten some texts" |
| Disconnect | The storefront is turned off first (main script disabled, design kept; other scripts and the page removed) |
| Connect to another bCloud account | A storefront that is on is updated with the new site token |
| App update with new storefront files | The Storefront page shows "Out of date" and an Update button |

## 7. Storefront (phase 2)

**What the Storefront page does** (`app/portal/bigcommerce/storefront.server.ts`; no database table:
the main script is the storage):

| Turn on / Update | Turn off | Tracking on / off | Save design |
|---|---|---|---|
| Makes or updates the `/bcloud-search/` page, the 6 widget templates and 4 scripts | Main script disabled (design kept), other scripts and the page deleted | `commerce` flag in the main script; purchase script made or deleted | Design JSON written into the main script (made switched off if the storefront was never on) |

**Scripts** (all `footer`, `script_tag`, `auto_uninstall: true`; names use letters and spaces only:
BigCommerce refuses a `:` in a script name with 422 "Script name contains invalid characters",
seen on a real store 2 Nov 2026):

| Name | Visibility | Consent category | Does |
|---|---|---|---|
| bCloud AI Search | storefront | essential | Sets `window.__bcloudBoot` (base64 JSON), loads `bcloud.css` and `bcloud.js` |
| bCloud AI Search analytics consent | storefront | analytics | `__bcloudConsent.analytics = true` |
| bCloud AI Search preferences consent | storefront | functional | `__bcloudConsent.functional = true` (recent searches) |
| bCloud AI Search purchases | order_confirmation | analytics | `{{checkout.order.id}}` → `bcloud-purchase.js` → `GET /api/storefront/order/{id}` → `POST /shop/track` |

**On the storefront**: suggestions on the theme's search box (default selector
`form[action*='search.php'] input[name='search_query']`, Cornerstone's `.quickSearchResults` hidden),
voice and picture search, the assistant, the AI search page (theme search forms and `/search.php?search_query=`
go to `/bcloud-search/?q=` while AI search results are on), and the Page Builder widgets (Page
Builder > Custom): AI search bar, AI search results, trending, recommendations, similar products
(product id read from `.productView[data-entity-id]` or the add-to-cart form), popular categories.

**Tracking** (same events as the Shopify web pixel): `view` on product pages, `add_to_cart` after
`/api/storefront/carts` shows the product (and on card `cart.php?action=add` links), `purchase` per
order line with `value` = `extendedSalePrice` and `user_id` = the order's customer number. Each
order is sent once per browser.

**Tested** against a fake BigCommerce (Scripts, Pages and Widget rules from the docs), a fake
Stencil storefront and a fake bCloud: 57 storefront checks and 53 admin checks pass.

**REQUIRES VERIFICATION on a real Stencil store** (dev store):

* Handlebars filling `{{checkout.order.id}}` inside a Script Manager script (community answers say
  yes; the fallback reads the id from `/checkout/order-confirmation/{id}`).
* The order confirmation script needing only Content: modify (no Checkout content scope).
* Page Builder listing templates whose schema is only a `hidden` setting.
* `name:like` on `GET /v3/content/pages` matching the page body (fallback: the page id kept in the
  main script).
* The theme's selectors (search box, quick results, `.productView[data-entity-id]`) on themes other
  than Cornerstone; the Storefront page lets the merchant change the search box ones.
* Cross-origin script loading from `APP_URL` when the store sets a Content Security Policy.

**Not covered / out of scope**

* **Headless (Catalyst) storefronts** and channels other than the default one (channel 1).
* Currency conversion: prices show in the store's default currency.
* Customer id on storefront events: only purchases carry it (from the order).
* Out of scope as in the Shopify app: Best Fit, comparison API, universal content search, any search,
  ranking, recommendation, analytics or billing engine inside the app.
* **Code shared with the Shopify app** (pages, bCloud client, sync, storefront JavaScript) is a copy:
  a change to one app must be made in the other too, until both move to a shared package.
