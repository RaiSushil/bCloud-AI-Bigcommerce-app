# Access requests: bCloud partner API

**Status: CONFIRMED live by bCloud (22 Oct 2026)**, as below. The app's "Request access" link shows
when the app server sets `BCLOUD_ACCESS_REQUESTS=on` and `BCLOUD_PARTNER_KEY`.

## The flow

1. A store without credentials opens the bCloud app and clicks **Request access from bCloud** under
   the Connect form. It fills in owner name, email, store name, store domain and an optional
   contact number (prefilled from the store's own details).
2. The app's server sends the request to bCloud (endpoint 1). The store address (`shop_domain`)
   comes from the platform's verified session, never from the form:
   `my-store.myshopify.com` on Shopify, `store-{hash}.mybigcommerce.com` on BigCommerce.
3. **Auto-approve (on since Nov 2026)**: bCloud's first answer usually already says `approved`; the app
   then collects the keys at once (step 4 without waiting for the merchant to come back). Otherwise a
   bCloud admin approves or declines it on bCloud's side. **bCloud sends no email**: the app
   shows the status on the Connect page.
4. When the merchant opens the Connect page, the app asks for the answer (endpoint 2), at most once
   a minute per store ("Check now" asks at once). On approval it receives the credentials, checks
   them exactly like the Connect form (login, key belongs to the same account), connects the store,
   starts the first product sync, and confirms delivery (endpoint 3). The credentials go from bCloud
   to the app's server only; they never reach the browser.

All three endpoints use the existing partner key in the `X-Partner-Key` header; a key only sees its
own requests. bCloud allows up to 10 `/partner/` calls a second.

## 1. Send a request

`POST /partner/access-requests` · header `X-Partner-Key`

```json
{
  "platform": "shopify",
  "shop_domain": "my-store.myshopify.com",
  "store_url": "www.mystore.com",
  "store_name": "My Store",
  "contact_name": "Owner Name",
  "email": "owner@mystore.com",
  "phone": "+91 98765 43210",
  "app_ref": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
}
```

`platform` is `shopify` or `bigcommerce` (REQUIRES VERIFICATION that bCloud accepts `bigcommerce`;
a refusal shows as "bCloud did not accept some of the details"). `phone` may be `null`.
`app_ref` is a new UUID per send.

| Status | Body | What the app does |
|---|---|---|
| `201` | `{ "request_id": "req_…", "status": "pending", "created_at": "…" }` | Keeps the request id, shows "Access requested" |
| `200` | same, for a repeated `app_ref` | Same; the app repeats a send once (same `app_ref`) after a network error or 5xx |
| `409` | `{ "request_id": "req_…", "status": "pending" }` | An open request already exists for this store: keeps its id |
| `409` | `{ "error": "…", "client_id": "…" }` | The store already has a bCloud client: tells the merchant to connect with that client ID |
| `422` | validation body | "bCloud did not accept some of the details" |
| `401` / `403` | | "This app is not allowed to send requests to bCloud yet" |

`request_id`: `req_` followed by 16 hex characters.

## 2. Read the answer

`GET /partner/access-requests/{request_id}` · header `X-Partner-Key`

```json
{
  "request_id": "req_…",
  "status": "approved",
  "note": "Welcome to bCloud!",
  "decided_at": "2026-10-22T12:30:00Z",
  "client_id": "my-store",
  "credentials": { "client_id": "my-store", "dashboard_password": "…", "api_key": "…", "site_token": "…" }
}
```

* `status`: `pending` | `approved` | `declined` (a decline shows bCloud's `note`).
* `credentials`: returned after approval until delivery is confirmed, or for 7 days. After that it is
  `null` and a `hint` says what to renew (`rotate-key`, `portal-password`); the app then tells the
  merchant their client ID and to ask bCloud support for a new key or password.
* `site_token` is not used from here: the app reads it at sign-in, as with the Connect form.
* `404`: unknown id. The app shows the request as closed and offers a new one.

## 3. Confirm delivery

`POST /partner/access-requests/{request_id}/delivered` · header `X-Partner-Key` · body `{}`
→ `200 { "ok": true, "request_id": "req_…", "status": "approved", "delivered_at": "…" }`.

Sent only after the store is connected with the credentials. From then on endpoint 2 returns
`"credentials": null`. If connecting fails, delivery is not confirmed, so "Check now" can try again.

## What the app keeps

One row per store (`BcloudAccessRequest`): bCloud's `request_id`, the status, the masked email
(`pr•••@mystore.com`), the note and the dates. It keeps no name or phone, and the email only
masked. The row is deleted when the app is uninstalled.
