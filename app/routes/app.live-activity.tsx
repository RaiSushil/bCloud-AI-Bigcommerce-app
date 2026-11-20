import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { portalApi } from "../portal/api/index.server";
import { withPortal } from "../portal/api/route.server";
import { LiveActivityPage } from "../portal/pages/live/LiveActivityPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => {
    const filter = portalApi.liveActivity.parseFilter(new URL(request.url).searchParams.get("filter"));
    return { data: await portalApi.liveActivity.get(ctx, filter), now: Date.now() };
  });

export default function LiveActivityRoute() {
  const { data, now } = useLoaderData<typeof loader>();
  return <LiveActivityPage data={data} now={now} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
