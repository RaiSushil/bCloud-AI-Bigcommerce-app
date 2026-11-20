/**
 * Connecting a store to its bCloud account (server only). Used by the Connect form and by an
 * approved access request, so both follow exactly the same checks:
 *
 *   1. POST /client-api/login proves the client ID and dashboard password work
 *   2. one BigCommerce store per bCloud account (a full sync removes what the store did not send)
 *   3. the login is saved encrypted; the product API key is checked to belong to the same account
 *   4. the product webhooks are checked, so changes reach search by themselves
 *   5. the first full sync starts by itself, once
 *
 * The store always comes from the verified BigCommerce session. Nothing here is logged except the
 * store and the outcome.
 */
import type { StoreApi } from "../../bigcommerce/api.server";
import { ensureProductWebhooks } from "../../bigcommerce/webhooks.server";
import { PortalApiError } from "../errors";
import type { PortalContext } from "../http.server";
import { isSyncRunning, looksLikeApiKey, neverSynced, saveApiKey, startCatalogueSync } from "../ingest/catalogue-sync.server";
import type { MutationResult } from "../types";
import { connectedShopFor, deleteConnection, getConnectionInfo, saveConnection } from "./connection.server";
import { EncryptionKeyError } from "./crypto.server";
import { forgetToken, login, rememberToken } from "./session.server";

const CLIENT_ID = /^[A-Za-z0-9._-]{2,100}$/;

/** At most 5 failed sign-ins per shop in 10 minutes (bCloud also locks after 8). */
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __bcloudConnectFailures: Map<string, number[]> | undefined;
}
const failures = (globalThis.__bcloudConnectFailures ??= new Map<string, number[]>());

function recentFailures(shop: string): number[] {
  const list = (failures.get(shop) ?? []).filter((t) => Date.now() - t < FAILURE_WINDOW_MS);
  failures.set(shop, list);
  return list;
}

export interface Credentials {
  clientId: string;
  password: string;
  /** May be empty when reconnecting the same account that already has a saved key. */
  apiKey: string;
}

export async function connectStore(ctx: PortalContext, api: StoreApi, input: Credentials): Promise<MutationResult> {
  const clientId = input.clientId.trim();
  const password = input.password;
  const apiKey = input.apiKey.trim();
  if (!CLIENT_ID.test(clientId)) return { ok: false, error: "Enter a valid client ID.", field: "client_id" };
  if (!password || password.length > 200) return { ok: false, error: "Enter the dashboard password.", field: "password" };
  if (apiKey && !looksLikeApiKey(apiKey)) {
    return { ok: false, error: "That does not look like a bCloud product API key.", field: "api_key" };
  }
  if (recentFailures(ctx.shop).length >= MAX_FAILURES) {
    return { ok: false, error: "Too many attempts. Please wait 10 minutes and try again." };
  }
  if (await isSyncRunning(ctx.shop)) {
    return { ok: false, error: "A catalogue sync is running. Wait for it to finish before switching accounts." };
  }

  try {
    // 1. Prove the login works before saving anything.
    const result = await login(clientId, password);
    // 2. One BigCommerce store per bCloud account.
    const other = await connectedShopFor(result.client.clientId);
    if (other && other !== ctx.shop) {
      return {
        ok: false,
        error: `This bCloud account is already connected to another BigCommerce store (store ${other}). Disconnect it there first, or ask bCloud for a separate account for this store.`,
      };
    }
    const before = await getConnectionInfo(ctx.shop);
    const keepsKey = !!before?.apiKeyEnc && before.clientId === result.client.clientId;
    if (!apiKey && !keepsKey) {
      return { ok: false, error: "Enter the product API key from bCloud.", field: "api_key" };
    }

    // 3. Save the login (encrypted), then check the key belongs to this same account.
    const version = await saveConnection(ctx.shop, {
      clientId: result.client.clientId,
      password,
      siteToken: result.client.siteToken,
    });
    rememberToken(ctx.shop, result.token, version);
    failures.delete(ctx.shop);
    if (apiKey) {
      const key = await saveApiKey(ctx.shop, apiKey, { autoSync: false });
      if (!key.ok) {
        // A first connection is all or nothing; an existing one keeps its new login.
        if (!before) {
          await deleteConnection(ctx.shop);
          forgetToken(ctx.shop);
        }
        return { ok: false, error: key.error, field: key.field ?? "api_key" };
      }
    }

    // 4. Product webhooks (made at install; checked again here). A failure does not undo the
    // connection: the hooks are checked again each time the app is opened.
    let storeNote = "";
    try {
      await ensureProductWebhooks(api);
    } catch {
      storeNote = " Automatic product updates could not be switched on yet; they are retried the next time you open the app.";
    }

    // 5. The first full sync runs by itself, once; webhooks keep search current after that.
    let syncNote = "";
    if (await neverSynced(ctx.shop)) {
      const started = await startCatalogueSync(ctx.shop);
      syncNote = started.ok
        ? " Your products are being sent to bCloud now; they reach search within a few minutes."
        : ` The first product sync did not start: ${started.error}`;
    }
    return { ok: true, message: `Connected to ${result.client.name || result.client.clientId}.${storeNote}${syncNote}` };
  } catch (error) {
    if (error instanceof PortalApiError) {
      if (error.status === 401) recentFailures(ctx.shop).push(Date.now());
      return { ok: false, error: error.message, field: error.code === "bad_login" ? "password" : undefined };
    }
    // Two stores connecting the same account at the same moment: the database refuses the second.
    if ((error as { code?: string } | null)?.code === "P2002") {
      return { ok: false, error: "This bCloud account is already connected to another store." };
    }
    if (error instanceof EncryptionKeyError) {
      console.error(`[portal] ${error.message}`);
      return { ok: false, error: "This app server is not set up to store bCloud logins yet (missing encryption key)." };
    }
    throw error;
  }
}
