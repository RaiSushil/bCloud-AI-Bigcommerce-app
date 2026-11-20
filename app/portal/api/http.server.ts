/**
 * The single HTTP client for the bCloud API (server only).
 *
 * Every real API call goes through `apiRequest`, so sign-in, timeouts,
 * retries, error handling and logging live in one place. Components never
 * call fetch directly, and no token or password ever reaches the browser.
 */
import { forgetRefusedToken, getToken } from "./auth/session.server";
import { EncryptionKeyError } from "./auth/crypto.server";
import { getPortalConfig } from "./config.server";
import { ENDPOINTS, type EndpointKey } from "./endpoints";
import { PortalApiError } from "./errors";

export { PortalApiError } from "./errors";

/** Who is asking. Built from the verified BigCommerce session in each loader; `shop` is the store hash. */
export interface PortalContext {
  shop: string;
}

interface RequestOptions {
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  /** Public storefront endpoints (?site=) need no sign-in. */
  public?: boolean;
}

/** GET requests are retried once on these (never POST: no double tickets or charges). */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn(ctx: PortalContext): Promise<string> {
  try {
    return await getToken(ctx.shop);
  } catch (error) {
    if (error instanceof EncryptionKeyError) {
      // Developer detail goes to the server log only.
      console.error(`[portal] ${error.message}`);
      throw new PortalApiError("The bCloud connection is not set up on this server yet.", null, "login", "not_configured");
    }
    throw error;
  }
}

function buildUrl(base: string, path: string, options: RequestOptions): string {
  const url = new URL(base + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send(ctx: PortalContext, key: EndpointKey, options: RequestOptions): Promise<Response> {
  const config = getPortalConfig();
  const endpoint = ENDPOINTS[key];
  const url = buildUrl(config.baseUrl, endpoint.path, options);
  const maxAttempts = endpoint.method === "GET" ? 2 : 1;
  let signedInAgain = false;

  for (let attempt = 1; ; attempt++) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const token = options.public ? null : await signIn(ctx);
    if (token) headers.Authorization = `Bearer ${token}`;

    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logCall(ctx, key, timedOut ? "timeout" : "network_error", null, started, attempt);
      if (!timedOut && attempt < maxAttempts) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new PortalApiError(
        timedOut ? "The bCloud API did not answer in time." : "Could not reach the bCloud API.",
        null,
        key,
      );
    }

    logCall(ctx, key, response.ok ? "ok" : "http_error", response.status, started, attempt);
    if (response.ok) return response;

    // The error body is never forwarded to the browser.
    await response.body?.cancel().catch(() => undefined);

    // Token expired or revoked: sign in again once and repeat the call.
    // Safe for POST too: a 401 means bCloud did not act on the request.
    if (response.status === 401 && token && !signedInAgain) {
      signedInAgain = true;
      forgetRefusedToken(ctx.shop, token);
      continue;
    }
    if (RETRYABLE_STATUS.has(response.status) && attempt < maxAttempts) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    throw new PortalApiError(friendlyMessage(key, response.status), response.status, key);
  }
}

export async function apiRequest<T>(ctx: PortalContext, key: EndpointKey, options: RequestOptions = {}): Promise<T> {
  const response = await send(ctx, key, options);
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new PortalApiError("The bCloud API returned an unexpected answer.", response.status, key);
  }
}

function friendlyMessage(key: EndpointKey, status: number): string {
  if (status === 401 || status === 403) return "Your bCloud session is not authorised. Please reconnect the account.";
  if (status === 404) return key.startsWith("tickets") ? "That ticket was not found." : "This bCloud feature is not available yet.";
  if (status === 422) return "Some of the details were not accepted. Please check them and try again.";
  if (status === 429) {
    return key === "assistant"
      ? "blu has answered 20 questions in the last 10 minutes. Please try again shortly."
      : "Too many requests. Please wait a moment and try again.";
  }
  if (status === 503 && key === "assistant") return "blu is busy right now. Please try again in a moment.";
  if (status >= 500) return "bCloud is having a problem right now. Please try again shortly.";
  return "The request could not be completed.";
}

/** Logs only safe fields: never headers, bodies, tokens or passwords. */
function logCall(
  ctx: PortalContext,
  key: EndpointKey,
  outcome: string,
  status: number | null,
  started: number,
  attempt: number,
): void {
  console.info(
    JSON.stringify({
      event: "portal.api",
      shop: ctx.shop,
      endpoint: key,
      outcome,
      status,
      attempt,
      durationMs: Date.now() - started,
    }),
  );
}
