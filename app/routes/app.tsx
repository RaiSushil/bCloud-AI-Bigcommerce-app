import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";

import db from "../db.server";
import { portalApi, PortalApiError } from "../portal/api/index.server";
import { requireStoreSession } from "../portal/bigcommerce/session.server";
import { PortalShell } from "../portal/components/shell/PortalShell";
import { renderRouteError } from "../portal/route-boundary";
import portalCss from "../portal/styles/portal.css?url";
import pagesCss from "../portal/styles/pages.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: portalCss },
  { rel: "stylesheet", href: pagesCss },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { storeHash, userId } = await requireStoreSession(request);
  // The sidebar shows the bCloud account name; before Connect (or if the account API is down)
  // it shows the signed-in user's email and each page shows its own state.
  const user = await db.bcStoreUser.findUnique({ where: { storeHash_userId: { storeHash, userId } }, select: { email: true } });
  let userName = user?.email || `Store ${storeHash}`;
  try {
    userName = (await portalApi.account.get({ shop: storeHash })).companyName || userName;
  } catch (error) {
    if (!(error instanceof PortalApiError)) throw error;
  }
  return { userName };
};

export default function App() {
  const { userName } = useLoaderData<typeof loader>();
  return (
    <PortalShell userName={userName}>
      <Outlet />
    </PortalShell>
  );
}

/** A signed-out (or failed) layout shows the message without the shell. */
export function ErrorBoundary() {
  return (
    <div className="bc-portal" data-theme="light">
      <main className="bc-main">
        <div className="bc-page">{renderRouteError(useRouteError())}</div>
      </main>
    </div>
  );
}

export const headers: HeadersFunction = () => ({ "Cache-Control": "no-store" });
