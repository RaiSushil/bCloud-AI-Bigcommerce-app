import type { LoaderFunctionArgs } from "react-router";
import { BcConfigError } from "../bigcommerce.server";
import { storeApiFor } from "../portal/bigcommerce/api.server";
import { messagePage } from "../portal/bigcommerce/frame.server";
import { acceptLoad, InstallError, verifySignedPayload } from "../portal/bigcommerce/install.server";
import { sessionCookieFor } from "../portal/bigcommerce/session.server";
import { ensureProductWebhooksDaily } from "../portal/bigcommerce/webhooks.server";

/**
 * GET /load?signed_payload_jwt=...: the merchant opened the app from the control panel.
 * The payload is signed with the app's client secret; the store and user come from it.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const payload = verifySignedPayload(new URL(request.url).searchParams.get("signed_payload_jwt"));
    await acceptLoad(payload);
    void storeApiFor(payload.storeHash).then(ensureProductWebhooksDaily).catch(() => undefined);
    // Deep links stay inside the portal ("/" from the Apps menu opens Analytics).
    const deep = payload.url === "/app" || payload.url.startsWith("/app/") ? payload.url : "/app";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/store/${payload.storeHash}${deep}`,
        "Set-Cookie": sessionCookieFor(request, payload.user.id, payload.storeHash),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof BcConfigError) {
      console.error(JSON.stringify({ event: "bc.load", outcome: "not_configured" }));
      return messagePage("bCloud AI Search", "The app is not set up yet. Please contact bCloud support.", 500);
    }
    if (error instanceof InstallError) {
      return error.reason === "not_installed"
        ? messagePage("bCloud AI Search", "The app is not installed on this store. Install it again from the BigCommerce App Marketplace.", 404)
        : messagePage("bCloud AI Search", "This link has expired. Open the app again from Apps in your BigCommerce control panel.", 401);
    }
    throw error;
  }
}
