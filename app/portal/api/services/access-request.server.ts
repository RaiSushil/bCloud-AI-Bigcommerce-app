/**
 * "Request access" on the Connect page: a store without bCloud credentials (client ID,
 * dashboard password, product API key) asks bCloud for them, and gets the answer back in the
 * app (bCloud sends no email).
 *
 * Classification (project rules): CONFIRMED. bCloud's partner API for this is live (22 Oct 2026,
 * docs/access-request-api.md), under the existing /partner/ endpoints and their server-side
 * partner key:
 *
 *   POST /partner/access-requests                         send the request -> { request_id, status }
 *   GET  /partner/access-requests/{request_id}            pending | approved | declined (+ credentials until delivered, 7 days at most)
 *   POST /partner/access-requests/{request_id}/delivered  the app saved the credentials; bCloud stops returning them
 *
 * bCloud's admin approves or declines on bCloud's side. When a request is approved, the app
 * connects the store by itself with the same checks as the Connect form (connect.server.ts); the
 * credentials go from bCloud to this server only, never to the browser.
 *
 * Switched off unless BCLOUD_ACCESS_REQUESTS=on and BCLOUD_PARTNER_KEY are set, so nothing
 * changes before bCloud's API exists. The partner key is sent only in the X-Partner-Key header
 * and never logged; logs carry the shop and the outcome only, never the name, email or phone.
 * The BigCommerce store in the request comes from the verified session, not from the form.
 */
import { randomUUID } from "node:crypto";
import db from "../../../db.server";
import type { StoreApi } from "../../bigcommerce/api.server";
import { readStoreInfo, storeDomainFor } from "../../bigcommerce/store-info.server";
import { connectStore } from "../auth/connect.server";
import { getConnectionInfo } from "../auth/connection.server";
import { getPortalConfig } from "../config.server";
import type { PortalContext } from "../http.server";
import type { MutationResult } from "../types";
import type { AccessRequestPrefill, AccessRequestView } from "./access-request.types";

export type { AccessRequestPrefill, AccessRequestView } from "./access-request.types";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export function accessRequestConfig(env: Record<string, string | undefined> = process.env) {
  const on = (env.BCLOUD_ACCESS_REQUESTS ?? "").trim().toLowerCase() === "on";
  const partnerKey = env.BCLOUD_PARTNER_KEY?.trim() ?? "";
  return { enabled: on && partnerKey.length >= 16, partnerKey };
}

/** True when the link and form are shown. */
export const accessRequestsEnabled = () => accessRequestConfig().enabled;

/* ------------------------------------------------------------------ */
/* Prefill from the store's own BigCommerce details                    */
/* ------------------------------------------------------------------ */

const EMPTY_PREFILL: AccessRequestPrefill = { ownerName: "", email: "", storeName: "", domain: "", phone: "" };

/** The merchant can change every field; nothing here is required to send a request. */
export async function getAccessRequestPrefill(api: StoreApi): Promise<AccessRequestPrefill> {
  try {
    const info = await readStoreInfo(api);
    return {
      ownerName: info.ownerName,
      email: info.adminEmail,
      storeName: info.name,
      domain: info.domain || storeDomainFor(api.storeHash),
      phone: info.phone,
    };
  } catch {
    return EMPTY_PREFILL;
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PHONE = /^\+?[0-9 ()./-]{6,24}$/;

/** One line of plain text: no line breaks, trimmed, length-capped. */
const line = (value: string, max: number) => value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

/** "https://www.Shop.com/path" -> "www.shop.com". */
function cleanDomain(value: string): string {
  return line(value, 300)
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export interface AccessRequestInput {
  ownerName: string;
  email: string;
  storeName: string;
  domain: string;
  phone: string;
}

export function validateAccessRequest(
  raw: Record<string, string>,
): { ok: true; value: AccessRequestInput } | { ok: false; error: string; field: string } {
  const ownerName = line(raw.owner_name ?? "", 80);
  const email = line(raw.email ?? "", 120);
  const storeName = line(raw.store_name ?? "", 80);
  const domain = cleanDomain(raw.domain ?? "");
  const phone = line(raw.phone ?? "", 30);
  if (ownerName.length < 2) return { ok: false, error: "Enter the owner's name.", field: "owner_name" };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address. bCloud writes to it.", field: "email" };
  if (storeName.length < 2) return { ok: false, error: "Enter the store name.", field: "store_name" };
  if (!DOMAIN.test(domain)) {
    return { ok: false, error: "Enter the store's domain, for example mystore.com or store-abc123.mybigcommerce.com.", field: "domain" };
  }
  if (phone && !PHONE.test(phone)) return { ok: false, error: "Enter the contact number with digits only, or leave it empty.", field: "phone" };
  return { ok: true, value: { ownerName, email, storeName, domain, phone } };
}

/** "pradeep@example.com" -> "pr•••@example.com", for the page only. */
export function maskEmail(email: string): string {
  const [user, host] = email.split("@");
  if (!user || !host) return "";
  return `${user.slice(0, Math.min(2, user.length))}•••@${host}`;
}

/* ------------------------------------------------------------------ */
/* bCloud partner API (server only)                                    */
/* ------------------------------------------------------------------ */

const TIMEOUT_MS = 15_000;

class PartnerApiError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly body: unknown,
  ) {
    super(`partner api ${status ?? "network"}`);
  }
}

/**
 * One call to bCloud's partner API. GETs are retried once on network errors and 5xx; a POST only
 * when `retrySafe` (the send carries app_ref, which bCloud answers with the same request_id).
 * bCloud allows 10 partner calls a second; the app makes a few per merchant action at most.
 */
async function partnerCall<T>(method: "GET" | "POST", path: string, body?: unknown, opts: { retrySafe?: boolean } = {}): Promise<T> {
  const { partnerKey } = accessRequestConfig();
  const base = getPortalConfig().baseUrl;
  const url = new URL(base + path);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new PartnerApiError(null, null); // the partner key only ever travels over https
  }
  const attempts = method === "GET" || opts.retrySafe ? 2 : 1;
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "X-Partner-Key": partnerKey,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      log(path, "network_error", null, started);
      if (attempt < attempts) continue;
      throw new PartnerApiError(null, null);
    }
    log(path, res.ok ? "ok" : "http_error", res.status, started);
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (res.ok) return json as T;
    if (res.status >= 500 && attempt < attempts) continue;
    throw new PartnerApiError(res.status, json);
  }
}

/** Path-safe request id from bCloud's answer. */
function requestIdOf(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(value) ? value : null;
}

/** A bCloud client id from an answer (shown to the merchant, so checked first). */
function clientIdOf(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9._-]{2,100}$/.test(value) ? value : null;
}

const shortText = (value: unknown, max = 300) =>
  typeof value === "string" && value.trim() ? line(value, max) : null;

/* ------------------------------------------------------------------ */
/* Send a request                                                       */
/* ------------------------------------------------------------------ */

/** At most 3 requests per store per hour (a typo, not a flood). */
const MAX_PER_HOUR = 3;
declare global {
  // eslint-disable-next-line no-var
  var __bcloudAccessRequests: Map<string, number[]> | undefined;
}
const sent = (globalThis.__bcloudAccessRequests ??= new Map<string, number[]>());
function recent(shop: string): number[] {
  const list = (sent.get(shop) ?? []).filter((t) => Date.now() - t < 60 * 60 * 1000);
  sent.set(shop, list);
  return list;
}

/**
 * Sends the request. bCloud approves most requests at once (auto-approve, Nov 2026): when the
 * first answer already says "approved", the credentials are collected and the store is connected
 * straight away (GET .../{id}, then POST .../delivered), as "Check now" would.
 */
export async function sendAccessRequest(ctx: PortalContext, api: StoreApi, raw: Record<string, string>): Promise<MutationResult> {
  const shop = ctx.shop;
  if (!accessRequestsEnabled()) return { ok: false, error: "Requests can't be sent from this app yet. Please contact bCloud directly." };
  const checked = validateAccessRequest(raw);
  if (!checked.ok) return { ok: false, error: checked.error, field: checked.field };
  if (await getConnectionInfo(shop)) return { ok: false, error: "This store is already connected to bCloud." };

  const open = await db.bcloudAccessRequest.findUnique({ where: { shop } });
  if (open && (open.status === "pending" || open.status === "approved")) {
    return { ok: false, error: "A request for this store is already with bCloud. The answer will show on this page." };
  }
  if (recent(shop).length >= MAX_PER_HOUR) {
    return { ok: false, error: "This store has already sent 3 requests in the last hour. Please wait for bCloud's answer." };
  }

  const r = checked.value;
  let answer: { request_id?: unknown; status?: unknown } | null;
  try {
    answer = await partnerCall("POST", "/partner/access-requests", {
      platform: "bigcommerce",
      shop_domain: storeDomainFor(shop), // from the verified BigCommerce session, never from the form
      store_url: r.domain,
      store_name: r.storeName,
      contact_name: r.ownerName,
      email: r.email,
      phone: r.phone || null,
      app_ref: randomUUID(), // bCloud answers a repeat of the same send with the same request_id
    }, { retrySafe: true });
  } catch (error) {
    const status = error instanceof PartnerApiError ? error.status : null;
    const conflict = (error instanceof PartnerApiError && status === 409 ? error.body : null) as { request_id?: unknown; client_id?: unknown } | null;
    // bCloud already has an open request for this store: keep its id and show it.
    const existing = conflict ? requestIdOf(conflict.request_id) : null;
    // bCloud already has a client for this store: nothing to request.
    if (conflict && !existing) {
      const clientId = clientIdOf(conflict.client_id);
      console.info(JSON.stringify({ event: "bcloud.access_request", shop, outcome: "already_client" }));
      return {
        ok: false,
        error: clientId
          ? `This store already has a bCloud account (client ID ${clientId}). Connect with its client ID, dashboard password and product API key above. If you don't have them, please contact bCloud support.`
          : "This store already has a bCloud account. Connect with its details above, or contact bCloud support.",
      };
    }
    if (!existing) {
      console.info(JSON.stringify({ event: "bcloud.access_request", shop, outcome: "send_failed", status }));
      return {
        ok: false,
        error:
          status === 422
            ? "bCloud did not accept some of the details. Please check them and try again."
            : status === 401 || status === 403
              ? "This app is not allowed to send requests to bCloud yet. Please contact bCloud directly."
              : "The request could not be sent. Please try again in a few minutes.",
      };
    }
    answer = { request_id: existing, status: "pending" };
  }

  const requestId = requestIdOf(answer?.request_id);
  if (!requestId) {
    console.info(JSON.stringify({ event: "bcloud.access_request", shop, outcome: "bad_answer" }));
    return { ok: false, error: "bCloud's answer was not understood. Please try again in a few minutes." };
  }
  const row = {
    requestId,
    status: "pending",
    emailHint: maskEmail(r.email),
    note: null,
    submittedAt: new Date(),
    checkedAt: new Date(),
    decidedAt: null,
  };
  await db.bcloudAccessRequest.upsert({ where: { shop }, create: { shop, ...row }, update: row });
  recent(shop).push(Date.now());
  const approved = typeof answer?.status === "string" && answer.status.toLowerCase() === "approved";
  console.info(JSON.stringify({ event: "bcloud.access_request", shop, outcome: approved ? "sent_approved" : "sent" }));
  if (approved) {
    const connected = await refreshAccessRequest(ctx, api, { force: true });
    if (connected) return connected;
  }
  return {
    ok: true,
    message: "Request sent to bCloud. The answer will show on this page.",
  };
}

/* ------------------------------------------------------------------ */
/* Fetch the answer                                                     */
/* ------------------------------------------------------------------ */

/** Ask bCloud at most once a minute per store while a request is open. */
const CHECK_EVERY_MS = 60_000;

interface StatusAnswer {
  status?: unknown;
  note?: unknown;
  decided_at?: unknown;
  client_id?: unknown;
  /** After delivery, or 7 days after approval, credentials is null and the hint says what to do. */
  hint?: unknown;
  credentials?: { client_id?: unknown; dashboard_password?: unknown; api_key?: unknown; site_token?: unknown } | null;
}

/**
 * Approved, but the credentials are gone (kept by bCloud for 7 days): what the merchant does next.
 * bCloud's hint names what must be renewed: "rotate-key" (product API key), "portal-password".
 */
function expiredNote(clientId: string | null, hint: unknown): string {
  const hints = (Array.isArray(hint) ? hint : [hint]).filter((h): h is string => typeof h === "string").join(" ").toLowerCase();
  const key = hints.includes("key");
  const password = hints.includes("password");
  const what =
    key && !password ? "a new product API key" : password && !key ? "a new dashboard password" : "a new product API key and dashboard password";
  return `bCloud approved the request, but the sign-in details are no longer available to the app (bCloud keeps them for 7 days).${
    clientId ? ` Your bCloud client ID is ${clientId}.` : ""
  } Ask bCloud support for ${what}, then connect with them above.`;
}

/**
 * Brings the store's request up to date. When bCloud approved it and returned the credentials,
 * connects the store (same checks as the Connect form), then tells bCloud they were delivered.
 * `force` skips the once-a-minute limit (the "Check now" button).
 */
export async function refreshAccessRequest(
  ctx: PortalContext,
  api: StoreApi,
  opts: { force?: boolean } = {},
): Promise<MutationResult | null> {
  if (!accessRequestsEnabled()) return null;
  const row = await db.bcloudAccessRequest.findUnique({ where: { shop: ctx.shop } });
  if (!row || (row.status !== "pending" && row.status !== "approved")) return null;
  if (await getConnectionInfo(ctx.shop)) return null; // connected meanwhile (e.g. typed by hand)
  if (!opts.force && row.checkedAt && Date.now() - row.checkedAt.getTime() < CHECK_EVERY_MS) return null;

  let answer: StatusAnswer;
  try {
    answer = await partnerCall<StatusAnswer>("GET", `/partner/access-requests/${encodeURIComponent(row.requestId)}`);
  } catch (error) {
    await db.bcloudAccessRequest.update({ where: { shop: ctx.shop }, data: { checkedAt: new Date() } });
    const status = error instanceof PartnerApiError ? error.status : null;
    if (status === 404) {
      await db.bcloudAccessRequest.update({
        where: { shop: ctx.shop },
        data: { status: "declined", note: "bCloud no longer has this request. Please send a new one." },
      });
    }
    return opts.force ? { ok: false, error: "bCloud could not be asked right now. Please try again in a minute." } : null;
  }

  const status = typeof answer?.status === "string" ? answer.status.toLowerCase() : "";
  const note = shortText(answer?.note);
  const decidedAt = typeof answer?.decided_at === "string" && Number.isFinite(Date.parse(answer.decided_at)) ? new Date(answer.decided_at) : null;

  if (status === "declined" || status === "rejected") {
    await db.bcloudAccessRequest.update({
      where: { shop: ctx.shop },
      data: { status: "declined", note: note ?? "bCloud declined this request.", decidedAt: decidedAt ?? new Date(), checkedAt: new Date() },
    });
    return { ok: true, message: "bCloud answered your request." };
  }

  if (status !== "approved") {
    await db.bcloudAccessRequest.update({ where: { shop: ctx.shop }, data: { checkedAt: new Date() } });
    return opts.force ? { ok: true, message: "Still waiting for bCloud." } : null;
  }

  // Approved. With credentials, connect now. Without them (already delivered, or older than
  // 7 days) the note says what to ask bCloud for; if connecting fails, Check now tries again.
  const c = answer.credentials ?? null;
  const creds =
    c && typeof c.client_id === "string" && typeof c.dashboard_password === "string" && typeof c.api_key === "string"
      ? { clientId: c.client_id, password: c.dashboard_password, apiKey: c.api_key }
      : null;
  const missing = creds ? null : expiredNote(clientIdOf(answer.client_id ?? c?.client_id), answer.hint);
  await db.bcloudAccessRequest.update({
    where: { shop: ctx.shop },
    data: { status: "approved", note: missing ?? note, decidedAt: decidedAt ?? new Date(), checkedAt: new Date() },
  });
  if (!creds) return { ok: true, message: missing ?? "bCloud approved your request." };

  const connected = await connectStore(ctx, api, creds);
  if (!connected.ok) {
    console.info(JSON.stringify({ event: "bcloud.access_request", shop: ctx.shop, outcome: "approved_connect_failed" }));
    await db.bcloudAccessRequest.update({
      where: { shop: ctx.shop },
      data: { note: `Approved, but connecting with bCloud's details failed: ${connected.error} Use Check now to try again, or contact bCloud support.` },
    });
    return { ok: false, error: `bCloud approved your request, but connecting failed: ${connected.error}` };
  }
  await db.bcloudAccessRequest.update({ where: { shop: ctx.shop }, data: { status: "connected" } });
  // Tell bCloud the credentials arrived, so it stops returning them. A failure here is harmless.
  await partnerCall("POST", `/partner/access-requests/${encodeURIComponent(row.requestId)}/delivered`, {}).catch(() => undefined);
  console.info(JSON.stringify({ event: "bcloud.access_request", shop: ctx.shop, outcome: "connected" }));
  return { ok: true, message: `bCloud approved your request. ${connected.message ?? "Connected."}` };
}

/** What the Connect page shows (no ids, no secrets). */
export async function getAccessRequestView(shop: string): Promise<AccessRequestView | null> {
  const row = await db.bcloudAccessRequest.findUnique({ where: { shop } });
  if (!row) return null;
  return {
    status: row.status as AccessRequestView["status"],
    emailHint: row.emailHint,
    note: row.note,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/** App uninstalled: forget the request too. */
export async function deleteAccessRequest(shop: string): Promise<void> {
  await db.bcloudAccessRequest.deleteMany({ where: { shop } });
}

function log(path: string, outcome: string, status: number | null, started: number): void {
  const door = path.replace(/\/partner\/access-requests\/[^/]+/, "/partner/access-requests/{id}");
  console.info(JSON.stringify({ event: "bcloud.partner", path: door, outcome, status, durationMs: Date.now() - started }));
}
