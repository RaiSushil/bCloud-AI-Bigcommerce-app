import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { portalApi } from "../portal/api/index.server";
import { withPortal } from "../portal/api/route.server";
import { BillingPage } from "../portal/pages/billing/BillingPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => ({ data: await portalApi.billing.get(ctx) }));

export default function BillingRoute() {
  const { data } = useLoaderData<typeof loader>();
  return <BillingPage data={data} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
