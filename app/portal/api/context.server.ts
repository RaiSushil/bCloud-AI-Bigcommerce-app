import { requireStoreSession } from "../bigcommerce/session.server";
import { storeApiFor, type StoreApi } from "../bigcommerce/api.server";
import type { PortalContext } from "./http.server";

/**
 * Verifies the control panel request and returns who is asking.
 * The store always comes from the verified BigCommerce session (and the store in the URL must be
 * one this session was opened for), never from a form field, so one store can never read another
 * store's data.
 */
export async function getPortalContext(request: Request): Promise<PortalContext> {
  const { storeHash } = await requireStoreSession(request);
  return { shop: storeHash };
}

/** Same check, plus the BigCommerce API client for this store. */
export async function getAdminContext(request: Request): Promise<{ ctx: PortalContext; api: StoreApi }> {
  const { storeHash } = await requireStoreSession(request);
  return { ctx: { shop: storeHash }, api: await storeApiFor(storeHash) };
}
