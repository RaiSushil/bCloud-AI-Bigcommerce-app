import type { ActionFunctionArgs } from "react-router";
import { handleCatalogueWebhook } from "../portal/api/ingest/catalogue-webhooks.server";
import { verifyProductWebhook } from "../portal/bigcommerce/webhooks.server";

/**
 * BigCommerce product webhooks (created, updated, deleted, stock), registered per store by
 * webhooks.server.ts. The store's own header is checked first (BigCommerce does not sign
 * callbacks; the header set at registration is its documented check) and a bad one gets 401.
 * The change is queued and sent to bCloud in the background, so BigCommerce gets its 200 at once.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const text = await request.text();
  if (text.length > 64_000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const hook = verifyProductWebhook(request, body);
  if (!hook) return new Response(null, { status: 401 });
  try {
    await handleCatalogueWebhook(hook.storeHash, hook.scope, hook.productId);
  } catch (error) {
    // Never make BigCommerce retry for our own problem; the next change or a full sync heals it.
    console.error(`[portal] product webhook could not be queued for ${hook.storeHash}`, (error as Error)?.name);
  }
  return new Response(null, { status: 200 });
};
