import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { getAdminContext } from "../portal/api/context.server";
import { field } from "../portal/api/route.server";
import type { MutationResult } from "../portal/api/types";
import {
  getStorefrontView,
  setStorefrontTracking,
  turnOffStorefront,
  turnOnStorefront,
} from "../portal/bigcommerce/storefront.server";
import { renderRouteError } from "../portal/route-boundary";
import { StorefrontPage } from "../portal/pages/storefront/StorefrontPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, api } = await getAdminContext(request);
  return { data: await getStorefrontView(api, ctx.shop) };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<MutationResult> => {
  const { ctx, api } = await getAdminContext(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  const result =
    intent === "on"
      ? await turnOnStorefront(api, ctx.shop, {
          selector: form.has("selector") ? field(form, "selector") : undefined,
          hide: form.has("hide") ? field(form, "hide") : undefined,
        })
      : intent === "off"
        ? await turnOffStorefront(api, ctx.shop)
        : intent === "tracking_on" || intent === "tracking_off"
          ? await setStorefrontTracking(api, ctx.shop, intent === "tracking_on")
          : { ok: false, message: "Unknown action." };
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.message };
};

export default function StorefrontRoute() {
  const { data } = useLoaderData<typeof loader>();
  return <StorefrontPage data={data} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
