import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { getAdminContext } from "../portal/api/context.server";
import { field } from "../portal/api/route.server";
import type { MutationResult } from "../portal/api/types";
import { getDesignView, saveDesign } from "../portal/bigcommerce/storefront.server";
import { StorefrontDesignPage } from "../portal/pages/storefront-design/StorefrontDesignPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, api } = await getAdminContext(request);
  return { data: await getDesignView(api, ctx.shop) };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<MutationResult> => {
  const { ctx, api } = await getAdminContext(request);
  const form = await request.formData();
  if (field(form, "intent") !== "save") return { ok: false, error: "Unknown action." };
  const raw = form.get("settings");
  const result = await saveDesign(api, ctx.shop, typeof raw === "string" ? raw : "");
  return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.message };
};

export default function StorefrontDesignRoute() {
  const { data } = useLoaderData<typeof loader>();
  return <StorefrontDesignPage data={data} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
