import type { LoaderFunctionArgs } from "react-router";
import { BcConfigError } from "../bigcommerce.server";
import { storeApiFor } from "../portal/bigcommerce/api.server";
import { messagePage } from "../portal/bigcommerce/frame.server";
import { completeInstall, InstallError } from "../portal/bigcommerce/install.server";
import { sessionCookieFor } from "../portal/bigcommerce/session.server";
import { ensureProductWebhooks } from "../portal/bigcommerce/webhooks.server";

/**
 * GET /auth: BigCommerce's install callback (the "Auth Callback URL" in the Developer Portal).
 * Exchanges the code for the store's token, signs the merchant in and opens the app.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return messagePage("Install cancelled", "The app was not installed. You can install it again from the BigCommerce App Marketplace.", 400);
  }
  try {
    const { storeHash, user } = await completeInstall(url.searchParams);
    // Product webhooks keep search current; a failure here is retried on the next open.
    void storeApiFor(storeHash)
      .then((api) => ensureProductWebhooks(api))
      .catch((error) => console.warn(JSON.stringify({ event: "bc.webhooks", store: storeHash, outcome: "install_ensure_failed", name: error?.name })));
    return new Response(null, {
      status: 302,
      headers: { Location: `/store/${storeHash}/app/connect`, "Set-Cookie": sessionCookieFor(request, user.id, storeHash), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof BcConfigError) {
      console.error(JSON.stringify({ event: "bc.install", outcome: "not_configured" }));
      return messagePage("Install failed", "The app is not set up yet. Please contact bCloud support.", 500);
    }
    if (error instanceof InstallError) {
      return messagePage(
        "Install failed",
        error.reason === "bad_request" ? "This link is incomplete. Install the app again from your BigCommerce control panel." : "BigCommerce did not confirm the install. Please try installing the app again.",
        error.reason === "bad_request" ? 400 : 502,
      );
    }
    throw error;
  }
}
