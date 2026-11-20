import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getAdminContext } from "../portal/api/context.server";
import { isSyncRunning } from "../portal/api/ingest/catalogue-sync.server";
import { deleteConnection, getConnectionInfo } from "../portal/api/auth/connection.server";
import { connectStore } from "../portal/api/auth/connect.server";
import { forgetToken } from "../portal/api/auth/session.server";
import { getPortalConfig } from "../portal/api/config.server";
import { field } from "../portal/api/route.server";
import type { MutationResult } from "../portal/api/types";
import { ConnectPage } from "../portal/pages/connect/ConnectPage";
import { refreshStorefrontAfterConnect, turnOffStorefront } from "../portal/bigcommerce/storefront.server";
import {
  accessRequestsEnabled,
  getAccessRequestPrefill,
  getAccessRequestView,
  refreshAccessRequest,
  sendAccessRequest,
} from "../portal/api/services/access-request.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, api } = await getAdminContext(request);
  const enabled = accessRequestsEnabled();
  // An open access request is brought up to date when the merchant opens this page (at most
  // once a minute); an approved one connects the store here.
  if (enabled) await refreshAccessRequest(ctx, api);
  const info = await getConnectionInfo(ctx.shop);
  return {
    accessRequest: {
      enabled,
      prefill: enabled && !info ? await getAccessRequestPrefill(api) : null,
      request: enabled ? await getAccessRequestView(ctx.shop) : null,
    },
    connection: info
      ? {
          clientId: info.clientId,
          connectedAt: info.connectedAt.toISOString(),
          hasKey: !!info.apiKeyEnc,
          keyLast4: info.apiKeyLast4,
        }
      : null,
    staticMode: getPortalConfig().source === "mock" && getPortalConfig().apiServices.size === 0,
  };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<MutationResult> => {
  const { ctx, api } = await getAdminContext(request);
  const form = await request.formData();
  const intent = field(form, "intent");

  if (intent === "disconnect") {
    if (await isSyncRunning(ctx.shop)) {
      return { ok: false, error: "A catalogue sync is running. Wait for it to finish, then disconnect." };
    }
    // Product webhooks stay registered: with no saved key they are ignored, and a later
    // Connect picks them up again without another set-up.
    // The storefront is turned off first, so shoppers' browsers stop calling this bCloud account
    // (the design settings are kept in the switched-off script).
    const storefront = await turnOffStorefront(api, ctx.shop);
    await deleteConnection(ctx.shop);
    forgetToken(ctx.shop);
    return {
      ok: true,
      message: `Disconnected. Product updates stopped, and the saved bCloud login was deleted.${
        storefront.ok ? "" : " The storefront could not be turned off: turn it off on the Storefront page."
      }`,
    };
  }
  if (intent === "request_access") {
    return sendAccessRequest(ctx, api, {
      owner_name: field(form, "owner_name"),
      email: field(form, "email"),
      store_name: field(form, "store_name"),
      domain: field(form, "domain"),
      phone: field(form, "phone"),
    });
  }
  if (intent === "check_access") {
    return (await refreshAccessRequest(ctx, api, { force: true })) ?? { ok: true, message: "Nothing to check." };
  }
  if (intent !== "connect") return { ok: false, error: "Unknown action." };

  const result = await connectStore(ctx, api, {
    clientId: field(form, "client_id"),
    password: field(form, "password"),
    apiKey: field(form, "api_key"),
  });
  // A storefront that is on picks up the (new) site token.
  if (result.ok) await refreshStorefrontAfterConnect(api, ctx.shop);
  return result;
};

export default function ConnectRoute() {
  const { connection, staticMode, accessRequest } = useLoaderData<typeof loader>();
  return <ConnectPage connection={connection} staticMode={staticMode} accessRequest={accessRequest} />;
}
