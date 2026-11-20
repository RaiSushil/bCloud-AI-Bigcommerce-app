import type { LoaderFunctionArgs } from "react-router";
import { acceptRemoveUser, InstallError, verifySignedPayload } from "../portal/bigcommerce/install.server";

/** GET /remove_user?signed_payload_jwt=... (server to server): the user can no longer open the app. */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await acceptRemoveUser(verifySignedPayload(new URL(request.url).searchParams.get("signed_payload_jwt")));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof InstallError) return Response.json({ ok: false }, { status: 401 });
    throw error;
  }
}
