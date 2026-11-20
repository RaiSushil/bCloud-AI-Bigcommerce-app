/**
 * BigCommerce single-click app callbacks (docs: "Single-click app OAuth flow" and
 * "Single-click app callback handlers"):
 *
 *   GET /auth         install: exchange `code` for the store's access token
 *   GET /load         the merchant opens the app: verify signed_payload_jwt
 *   GET /uninstall    the merchant removed the app: delete everything kept for the store
 *   GET /remove_user  a user lost access to the app (multi-user apps)
 *
 * The store hash always comes from BigCommerce: the token response's `context`, or the `sub`
 * claim of a payload signed with the app's client secret. Nothing here trusts the browser.
 */
import db from "../../db.server";
import { BC_LOGIN_BASE, bcConfig } from "../../bigcommerce.server";
import { encryptAccessToken } from "./api.server";
import { JwtError, verifyHs256 } from "./jwt.server";
import { STORE_HASH } from "./session.server";

export class InstallError extends Error {
  constructor(public readonly reason: "bad_request" | "exchange_failed" | "bad_payload" | "not_installed") {
    super(`install_${reason}`);
    this.name = "InstallError";
  }
}

export interface BcUserRef {
  id: number;
  email: string | null;
}

/** "stores/abc123" -> "abc123" */
export function storeHashFromContext(context: unknown): string | null {
  if (typeof context !== "string") return null;
  const m = /^stores\/([^/]+)$/.exec(context);
  return m && STORE_HASH.test(m[1]) ? m[1].toLowerCase() : null;
}

function userRef(value: unknown): BcUserRef | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { id?: unknown; email?: unknown };
  const id = typeof v.id === "number" ? v.id : typeof v.id === "string" && /^\d+$/.test(v.id) ? Number(v.id) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { id, email: typeof v.email === "string" ? v.email.slice(0, 254) : null };
}

/** Test hook. */
export const installDeps: { fetch: typeof fetch | null } = { fetch: null };

/**
 * Install: POST https://login.bigcommerce.com/oauth2/token, then keep the token (encrypted),
 * the owner and the installing user.
 */
export async function completeInstall(params: URLSearchParams): Promise<{ storeHash: string; user: BcUserRef }> {
  const code = params.get("code");
  const scope = params.get("scope");
  const context = params.get("context");
  const queryHash = storeHashFromContext(context);
  if (!code || !scope || !queryHash || code.length > 512 || scope.length > 4_000) throw new InstallError("bad_request");

  const cfg = bcConfig();
  let body: { access_token?: unknown; scope?: unknown; user?: unknown; owner?: unknown; context?: unknown };
  try {
    const res = await (installDeps.fetch ?? fetch)(`${BC_LOGIN_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        scope,
        context,
        grant_type: "authorization_code",
        redirect_uri: `${cfg.appUrl}/auth`,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // BigCommerce's reason (for example a redirect_uri that differs from the Developer Portal's
      // Auth Callback URL, or a code that was already used). It holds no secrets; only the short
      // reason text is logged, never the request body.
      const reason = await res.text().then(errorReason, () => null);
      console.warn(JSON.stringify({ event: "bc.install", outcome: "exchange_refused", status: res.status, reason, redirect_uri: `${cfg.appUrl}/auth` }));
      throw new InstallError("exchange_failed");
    }
    body = (await res.json()) as typeof body;
  } catch (error) {
    if (error instanceof InstallError) throw error;
    console.warn(JSON.stringify({ event: "bc.install", outcome: "exchange_unreachable" }));
    throw new InstallError("exchange_failed");
  }

  const storeHash = storeHashFromContext(body.context);
  const owner = userRef(body.owner);
  const user = userRef(body.user);
  const token = typeof body.access_token === "string" ? body.access_token : "";
  // The token must be for the store the request named.
  if (!storeHash || storeHash !== queryHash || !owner || !user || token.length < 8) throw new InstallError("exchange_failed");

  const grantedScope = typeof body.scope === "string" ? body.scope.slice(0, 4_000) : scope;
  const accessTokenEnc = encryptAccessToken(storeHash, token);
  await db.$transaction([
    db.bcStore.upsert({
      where: { storeHash },
      create: { storeHash, accessTokenEnc, scope: grantedScope, ownerId: owner.id, ownerEmail: owner.email },
      update: { accessTokenEnc, scope: grantedScope, ownerId: owner.id, ownerEmail: owner.email },
    }),
    upsertUser(storeHash, owner, true),
    ...(user.id !== owner.id ? [upsertUser(storeHash, user, false)] : []),
  ]);
  console.info(JSON.stringify({ event: "bc.install", store: storeHash, outcome: "installed" }));
  return { storeHash, user };
}

/** The error text from a refused token exchange, at most 200 characters. */
function errorReason(text: string): string | null {
  let value: unknown = text;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    value = json.error_description ?? json.error ?? json.title ?? json.message ?? text;
  } catch {
    /* not JSON: keep the text */
  }
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, 200) : null;
}

function upsertUser(storeHash: string, user: BcUserRef, isOwner: boolean) {
  return db.bcStoreUser.upsert({
    where: { storeHash_userId: { storeHash, userId: user.id } },
    create: { storeHash, userId: user.id, email: user.email, isOwner },
    update: { email: user.email, ...(isOwner ? { isOwner: true } : {}) },
  });
}

export interface SignedPayload {
  storeHash: string;
  user: BcUserRef;
  owner: BcUserRef;
  /** Deep link path inside the app ("/" from the Apps menu). */
  url: string;
}

/** Verifies signed_payload_jwt: HS256 with the client secret, issuer "bc", audience = client id. */
export function verifySignedPayload(jwt: string | null): SignedPayload {
  if (!jwt) throw new InstallError("bad_payload");
  const cfg = bcConfig();
  let p: Record<string, unknown>;
  try {
    p = verifyHs256(jwt, cfg.clientSecret, { audience: cfg.clientId, issuer: "bc", leeway: 60 });
  } catch (error) {
    if (error instanceof JwtError) {
      console.warn(JSON.stringify({ event: "bc.signed_payload", outcome: error.reason }));
      throw new InstallError("bad_payload");
    }
    throw error;
  }
  const storeHash = storeHashFromContext(p.sub);
  const user = userRef(p.user);
  const owner = userRef(p.owner);
  if (!storeHash || !user || !owner) throw new InstallError("bad_payload");
  const url = typeof p.url === "string" && p.url.startsWith("/") && !p.url.startsWith("//") ? p.url.slice(0, 300) : "/";
  return { storeHash, user, owner, url };
}

/**
 * Load: the store must be installed. The owner always gets in; any other user BigCommerce
 * sends a signed payload for has been given access to the app by the owner (multi-user),
 * so they are added.
 */
export async function acceptLoad(payload: SignedPayload): Promise<void> {
  const store = await db.bcStore.findUnique({ where: { storeHash: payload.storeHash }, select: { ownerId: true } });
  if (!store) throw new InstallError("not_installed");
  const isOwner = payload.user.id === store.ownerId || payload.user.id === payload.owner.id;
  await upsertUser(payload.storeHash, payload.user, isOwner);
}

/** Everything the app keeps for a store. Used by /uninstall. */
export async function deleteStoreData(storeHash: string): Promise<void> {
  await db.$transaction([
    db.bcloudAccessRequest.deleteMany({ where: { shop: storeHash } }),
    db.bcloudConnection.deleteMany({ where: { shop: storeHash } }),
    db.bcStoreUser.deleteMany({ where: { storeHash } }),
    db.bcStore.deleteMany({ where: { storeHash } }),
  ]);
}

/**
 * Uninstall. BigCommerce has already removed the app and revoked its token by the time this
 * arrives (the payload is signed by BigCommerce), so everything kept for the store is deleted.
 */
export async function acceptUninstall(payload: SignedPayload): Promise<void> {
  await deleteStoreData(payload.storeHash);
  console.info(JSON.stringify({ event: "bc.uninstall", store: payload.storeHash, outcome: "deleted" }));
}

/** Remove user: the user can no longer open the app. The owner is never removed this way. */
export async function acceptRemoveUser(payload: SignedPayload): Promise<void> {
  await db.bcStoreUser.deleteMany({ where: { storeHash: payload.storeHash, userId: payload.user.id, isOwner: false } });
}
