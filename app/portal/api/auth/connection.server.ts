/**
 * Shop -> bCloud client mapping (table BcloudConnection).
 * The store always comes from the verified BigCommerce session.
 */
import db from "../../../db.server";
import { PortalApiError } from "../errors";
import { decryptSecret, encryptSecret, EncryptionKeyError, loadEncryptionKey } from "./crypto.server";

export interface BcloudCredentials {
  clientId: string;
  password: string;
  siteToken: string | null;
  /** Changes whenever the row changes (reconnect, password change). */
  version: number;
}

/** Cheap check used on every API call: is the shop connected, and which version of its login? */
export async function getConnectionVersion(shop: string): Promise<number | null> {
  const row = await db.bcloudConnection.findUnique({ where: { shop }, select: { updatedAt: true } });
  return row ? row.updatedAt.getTime() : null;
}

export async function getConnectionInfo(shop: string) {
  return db.bcloudConnection.findUnique({
    where: { shop },
    select: { clientId: true, siteToken: true, connectedAt: true, apiKeyLast4: true, apiKeyEnc: true },
  });
}

/** The shop already connected to this bCloud client, if any (one store per account). */
export async function connectedShopFor(clientId: string): Promise<string | null> {
  const row = await db.bcloudConnection.findUnique({ where: { clientId }, select: { shop: true } });
  return row?.shop ?? null;
}

/** Decrypted credentials for server-side sign-in. Never return these to a route. */
export async function getCredentials(shop: string): Promise<BcloudCredentials | null> {
  const row = await db.bcloudConnection.findUnique({ where: { shop } });
  if (!row) return null;
  let password: string;
  try {
    password = decryptSecret(row.passwordEnc, shop, loadEncryptionKey());
  } catch (error) {
    if (error instanceof EncryptionKeyError) throw error;
    // Wrong or changed key, or a damaged row: the merchant can fix it by reconnecting.
    console.error(`[portal] could not decrypt the saved bCloud login for ${shop}`);
    throw new PortalApiError("The saved bCloud login can't be read. Please reconnect.", 401, "login", "bad_login");
  }
  return { clientId: row.clientId, password, siteToken: row.siteToken, version: row.updatedAt.getTime() };
}

/** Returns the new version of the saved login. */
export async function saveConnection(
  shop: string,
  input: { clientId: string; password: string; siteToken: string | null },
): Promise<number> {
  const passwordEnc = encryptSecret(input.password, shop, loadEncryptionKey());
  const existing = await db.bcloudConnection.findUnique({ where: { shop }, select: { clientId: true } });
  // A different account: the saved ingestion key and sync summary belong to the old one.
  const reset =
    existing && existing.clientId !== input.clientId
      ? {
          apiKeyEnc: null,
          apiKeyLast4: null,
          syncState: "idle",
          syncRunId: null,
          syncError: null,
          syncFinishedAt: null,
          syncStartedAt: null,
          syncRebuiltAt: null,
        }
      : {};
  const row = await db.bcloudConnection.upsert({
    where: { shop },
    create: { shop, clientId: input.clientId, passwordEnc, siteToken: input.siteToken },
    update: { clientId: input.clientId, passwordEnc, siteToken: input.siteToken, ...reset },
  });
  return row.updatedAt.getTime();
}

/** Saves the public site token read from GET /client-api/me. */
export async function updateSiteToken(shop: string, siteToken: string): Promise<void> {
  await db.bcloudConnection.updateMany({ where: { shop }, data: { siteToken } });
}

/** Keeps our copy in step after a successful POST /client-api/change-password. */
export async function updateStoredPassword(shop: string, password: string): Promise<void> {
  const passwordEnc = encryptSecret(password, shop, loadEncryptionKey());
  await db.bcloudConnection.update({ where: { shop }, data: { passwordEnc } });
}

export async function deleteConnection(shop: string): Promise<void> {
  await db.bcloudConnection.deleteMany({ where: { shop } });
}
