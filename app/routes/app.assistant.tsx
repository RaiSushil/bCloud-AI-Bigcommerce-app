import type { ActionFunctionArgs } from "react-router";
import { getPortalContext, portalApi, PortalApiError } from "../portal/api/index.server";
import { field } from "../portal/api/route.server";

/** Resource route for the blu assistant panel (POST only, no page). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await getPortalContext(request);
  const form = await request.formData();
  try {
    return await portalApi.assistant.ask(
      ctx,
      field(form, "message"),
      portalApi.assistant.parseHistory(field(form, "history")),
    );
  } catch (error) {
    if (error instanceof PortalApiError) {
      return {
        error:
          error.code === "not_connected"
            ? "Connect this store to bCloud first (Settings > Connection)."
            : error.message,
      };
    }
    throw error;
  }
};
