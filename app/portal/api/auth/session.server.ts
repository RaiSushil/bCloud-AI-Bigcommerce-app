/**
 * bCloud dashboard sign-in for the server (Client Dashboard API, section 2).
 *
 *   POST /client-api/login { client_id, password } -> { token, client: { client_id, name, site_token, theme } }
 *
 * The token lives 8 hours. It is cached in memory per shop and never sent to
 * the browser. Every cached token is tied to the version of the shop's saved
 * login (BcloudConnection.updatedAt), checked on each call, so a disconnect,
 * reconnect or password change on any server instance takes effect at once.
 * A 401 on any call clears the token so the next call signs in again.
 */
import { getPortalConfig } from "../config.server";
import { PortalApiError } from "../errors";
import { getConnectionVersion, getCredentials } from "./connection.server";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const SAFETY_MARGIN_MS = 10 * 60 * 1000;
/** After a refused sign-in, stop trying for a while so bCloud's lockout is not triggered. */
const REFUSED_PAUSE_MS = 5 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
  version: number;
}

interface Refusal {
  error: PortalApiError;
  until: number;
  version: number;
}

interface Store {
  tokens: Map<string, CachedToken>;
  inflight: Map<string, { generation: number; promise: Promise<string> }>;
  refusals: Map<string, Refusal>;
  /** Bumped by forgetToken so a sign-in that started earlier cannot store its result. */
  generations: Map<string, number>;
}

declare global {
  // eslint-disable-next-line no-var
  var __bcloudSession: Store | undefined;
}

const store: Store = (globalThis.__bcloudSession ??= {
  tokens: new Map(),
  inflight: new Map(),
  refusals: new Map(),
  generations: new Map(),
});

const generationOf = (shop: string) => store.generations.get(shop) ?? 0;

export interface LoginResult {
  token: string;
  client: { clientId: string; name: string; siteToken: string | null };
}

interface LoginResponse {
  token?: unknown;
  client?: { client_id?: unknown; name?: unknown; site_token?: unknown };
}

/** One sign-in call. Used by the Connect page and by the token cache. */
export async function login(clientId: string, password: string): Promise<LoginResult> {
  const { baseUrl, timeoutMs } = getPortalConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/client-api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new PortalApiError("Could not reach the bCloud API.", null, "login");
  }

  if (response.status === 401) {
    // The body says why; read it here, never forward it.
    const text = await response.text().catch(() => "");
    if (/not active/i.test(text)) {
      throw new PortalApiError("This bCloud account is paused.", 401, "login", "paused");
    }
    throw new PortalApiError("Wrong client ID or password.", 401, "login", "bad_login");
  }
  if (response.status === 429) {
    throw new PortalApiError("Too many sign-in attempts. Wait a few minutes and try again.", 429, "login");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new PortalApiError("bCloud sign-in failed. Please try again shortly.", response.status, "login");
  }

  const body = (await response.json().catch(() => ({}))) as LoginResponse;
  if (typeof body.token !== "string" || !body.token) {
    throw new PortalApiError("The bCloud API returned an unexpected answer.", response.status, "login");
  }
  return {
    token: body.token,
    client: {
      clientId: typeof body.client?.client_id === "string" ? body.client.client_id : clientId,
      name: typeof body.client?.name === "string" ? body.client.name : "",
      siteToken: typeof body.client?.site_token === "string" ? body.client.site_token : null,
    },
  };
}

/** Called by the Connect page after a successful sign-in and save. */
export function rememberToken(shop: string, token: string, version: number): void {
  forgetToken(shop);
  store.tokens.set(shop, { token, expiresAt: Date.now() + TOKEN_TTL_MS - SAFETY_MARGIN_MS, version });
}

/**
 * After a 401: drop the token that was refused, unless another request has
 * already replaced it with a fresh one (avoids a second sign-in).
 */
export function forgetRefusedToken(shop: string, refused: string): void {
  const current = store.tokens.get(shop);
  if (!current || current.token === refused) forgetToken(shop);
}

export function forgetToken(shop: string): void {
  store.generations.set(shop, generationOf(shop) + 1);
  store.tokens.delete(shop);
  store.inflight.delete(shop);
  store.refusals.delete(shop);
}

/** A valid token for this shop, signing in when needed (one sign-in at a time per shop). */
export async function getToken(shop: string): Promise<string> {
  const version = await getConnectionVersion(shop);
  if (version === null) {
    store.tokens.delete(shop);
    throw new PortalApiError("This store is not connected to bCloud yet.", null, "login", "not_connected");
  }

  const cached = store.tokens.get(shop);
  if (cached && cached.version === version && cached.expiresAt > Date.now()) return cached.token;

  const refusal = store.refusals.get(shop);
  if (refusal && refusal.version === version && refusal.until > Date.now()) throw refusal.error;

  const generation = generationOf(shop);
  const running = store.inflight.get(shop);
  if (running && running.generation === generation) return running.promise;

  const promise = (async () => {
    const credentials = await getCredentials(shop);
    if (!credentials) {
      throw new PortalApiError("This store is not connected to bCloud yet.", null, "login", "not_connected");
    }
    try {
      const result = await login(credentials.clientId, credentials.password);
      // Store only if nothing changed while signing in (disconnect, reconnect).
      if (generationOf(shop) === generation) {
        store.tokens.set(shop, {
          token: result.token,
          expiresAt: Date.now() + TOKEN_TTL_MS - SAFETY_MARGIN_MS,
          version: credentials.version,
        });
      }
      return result.token;
    } catch (error) {
      if (error instanceof PortalApiError && (error.code === "bad_login" || error.code === "paused")) {
        store.refusals.set(shop, { error, until: Date.now() + REFUSED_PAUSE_MS, version: credentials.version });
      }
      throw error;
    }
  })();

  store.inflight.set(shop, { generation, promise });
  try {
    return await promise;
  } finally {
    if (store.inflight.get(shop)?.promise === promise) store.inflight.delete(shop);
  }
}
