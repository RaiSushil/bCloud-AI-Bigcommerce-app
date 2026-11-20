import type { LoaderFunctionArgs } from "react-router";
import { acceptUninstall, InstallError, verifySignedPayload } from "../portal/bigcommerce/install.server";

/** GET /uninstall?signed_payload_jwt=... (server to server): delete everything kept for the store. */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await acceptUninstall(verifySignedPayload(new URL(request.url).searchParams.get("signed_payload_jwt")));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof InstallError) return Response.json({ ok: false }, { status: 401 });
    throw error;
  }
}
