import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { PASSWORD_MIN_LENGTH, portalApi } from "../portal/api/index.server";
import { field, runMutation, withPortal } from "../portal/api/route.server";
import { SettingsPage } from "../portal/pages/settings/SettingsPage";
import { renderRouteError } from "../portal/route-boundary";

/** Settings: account, password, Integration doctor, Search settings (synonyms) and Support (tickets). */
export const loader = ({ request }: LoaderFunctionArgs) =>
  withPortal(request, async (ctx) => {
    const now = Date.now();
    const [account, synonyms, support] = await Promise.all([
      portalApi.account.get(ctx),
      portalApi.synonyms.get(ctx),
      portalApi.support.get(ctx),
    ]);
    return {
      account,
      doctor: portalApi.overview.doctor(account, now),
      synonyms,
      support,
      selectedTicket: new URL(request.url).searchParams.get("ticket"),
      passwordMinLength: PASSWORD_MIN_LENGTH,
      now,
    };
  });

export const action = ({ request }: ActionFunctionArgs) =>
  runMutation(request, async (ctx, form) => {
    switch (field(form, "intent")) {
      case "change-password":
        return portalApi.account.changePassword(ctx, {
          current: field(form, "current"),
          next: field(form, "next"),
          confirm: field(form, "confirm"),
        });
      case "synonym-add":
        return portalApi.synonyms.add(ctx, field(form, "a"), field(form, "b"));
      case "synonym-remove":
        return portalApi.synonyms.remove(ctx, field(form, "id"));
      case "ticket-create":
        return portalApi.support.create(ctx, {
          subject: field(form, "subject"),
          message: field(form, "message"),
          priority: field(form, "priority"),
        });
      case "ticket-reply":
      case "ticket-resolve":
        return portalApi.support.update(ctx, {
          ticketId: field(form, "ticketId"),
          action: field(form, "intent") === "ticket-reply" ? "reply" : "resolve",
          message: field(form, "message"),
        });
      default:
        return { ok: false, error: "Unknown action." };
    }
  });

export default function SettingsRoute() {
  const d = useLoaderData<typeof loader>();
  return (
    <SettingsPage
      account={d.account}
      doctor={d.doctor}
      synonyms={d.synonyms}
      support={d.support}
      selectedTicket={d.selectedTicket}
      passwordMinLength={d.passwordMinLength}
      now={d.now}
    />
  );
}

export function ErrorBoundary() {
  return renderRouteError(useRouteError());
}
