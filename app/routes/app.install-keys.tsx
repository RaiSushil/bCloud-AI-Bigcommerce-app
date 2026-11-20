import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { getPortalContext, portalApi, PortalApiError } from "../portal/api/index.server";
import { listApiDoors, runApiCheck } from "../portal/api/services/apicheck.server";
import { field, withPortal } from "../portal/api/route.server";
import { InstallPage } from "../portal/pages/install/InstallPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => ({ data: await portalApi.install.get(ctx), doors: listApiDoors(ctx) }));

/** Live preview search and the API check: both run server-side with the shop's own keys. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await getPortalContext(request);
  const form = await request.formData();
  if (field(form, "intent") === "api_check") {
    try {
      return { ok: true as const, run: await runApiCheck(ctx) };
    } catch (error) {
      console.error("[portal] api check failed", (error as Error)?.name);
      return { ok: false as const, error: "The check could not run. Please try again." };
    }
  }
  if (field(form, "intent") !== "preview") return { error: "Unknown action." };
  try {
    return await portalApi.install.preview(ctx, field(form, "query"));
  } catch (error) {
    if (error instanceof PortalApiError) return { error: error.message };
    throw error;
  }
};

export default function InstallKeysRoute() {
  const { data, doors } = useLoaderData<typeof loader>();
  return <InstallPage data={data} doors={doors} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
