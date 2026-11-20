import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { portalApi } from "../portal/api/index.server";
import { withPortal } from "../portal/api/route.server";
import { ProductsPage } from "../portal/pages/products/ProductsPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => {
    const query = portalApi.products.parseQuery(new URL(request.url).searchParams);
    return { data: await portalApi.products.get(ctx, query) };
  });

export default function ProductsRoute() {
  const { data } = useLoaderData<typeof loader>();
  return <ProductsPage data={data} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
