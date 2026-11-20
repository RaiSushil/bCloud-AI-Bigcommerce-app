import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { portalApi } from "../portal/api/index.server";
import { withPortal } from "../portal/api/route.server";
import { AnalyticsPage } from "../portal/pages/analytics/AnalyticsPage";
import { renderRouteError } from "../portal/route-boundary";

/** Analytics (the first page): bCloud's overview and search analytics on one page. */
export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const door = portalApi.analytics.parseDoor(params.get("door"));
    const range = portalApi.analytics.parseRange(params.get("range"));
    const [overview, data] = await Promise.all([portalApi.overview.get(ctx), portalApi.analytics.get(ctx, door, range)]);
    return { overview, data, now: Date.now() };
  });

export default function AnalyticsRoute() {
  const { overview, data, now } = useLoaderData<typeof loader>();
  return <AnalyticsPage overview={overview} data={data} now={now} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
