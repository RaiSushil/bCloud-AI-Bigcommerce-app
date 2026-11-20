import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { portalApi } from "../portal/api/index.server";
import { field, runMutation, withPortal } from "../portal/api/route.server";
import { MissedSearchesPage } from "../portal/pages/missed/MissedSearchesPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => ({ data: await portalApi.missedSearches.get(ctx), now: Date.now() }));

export const action = ({ request }: ActionFunctionArgs) =>
  runMutation(request, async (ctx, form) => {
    if (field(form, "intent") !== "connect") return { ok: false, error: "Unknown action." };
    return portalApi.missedSearches.connect(ctx, field(form, "query"), field(form, "target"));
  });

export default function MissedSearchesRoute() {
  const { data, now } = useLoaderData<typeof loader>();
  return <MissedSearchesPage data={data} now={now} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
