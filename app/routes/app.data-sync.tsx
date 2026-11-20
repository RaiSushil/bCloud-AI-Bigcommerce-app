import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { getPortalContext } from "../portal/api/context.server";
import { portalApi } from "../portal/api/index.server";
import {
  getCatalogueSync,
  removeApiKey,
  saveApiKey,
  startCatalogueSync,
  startPhotoJob,
} from "../portal/api/ingest/catalogue-sync.server";
import { getWebhookActivity } from "../portal/api/ingest/catalogue-webhooks.server";
import { getIngestStatus } from "../portal/api/ingest/ingest-status.server";
import { field, withPortal } from "../portal/api/route.server";
import type { MutationResult } from "../portal/api/types";
import { DataSyncPage } from "../portal/pages/data-sync/DataSyncPage";
import { renderRouteError } from "../portal/route-boundary";

export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => {
    const [data, catalogueSync, ingestStatus] = await Promise.all([
      portalApi.dataSync.get(ctx),
      getCatalogueSync(ctx.shop),
      getIngestStatus(ctx.shop),
    ]);
    return { data, catalogueSync, ingestStatus, webhooks: getWebhookActivity(ctx.shop), now: Date.now() };
  });

export const action = async ({ request }: ActionFunctionArgs): Promise<MutationResult> => {
  const ctx = await getPortalContext(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  if (intent === "save_key") return saveApiKey(ctx.shop, field(form, "api_key"));
  if (intent === "remove_key") return removeApiKey(ctx.shop);
  if (intent === "start_sync") return startCatalogueSync(ctx.shop);
  if (intent === "start_photos") return startPhotoJob(ctx.shop);
  return { ok: false, error: "Unknown action." };
};

export default function DataSyncRoute() {
  const { data, catalogueSync, ingestStatus, webhooks, now } = useLoaderData<typeof loader>();
  return <DataSyncPage data={data} catalogueSync={catalogueSync} ingestStatus={ingestStatus} webhooks={webhooks} now={now} />;
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
