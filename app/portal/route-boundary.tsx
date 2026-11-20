import { isRouteErrorResponse } from "react-router";
import { PageError } from "./components/shell/PageError";

const GENERIC = "Something went wrong. Please try again in a moment.";

/**
 * Error boundary for portal pages: portal API errors (and an ended session) show a friendly
 * card inside the layout. Nothing upstream is ever shown.
 */
export function renderRouteError(error: unknown) {
  if (isRouteErrorResponse(error)) {
    const payload = error.data as { portalError?: unknown; code?: unknown } | undefined;
    if (payload && typeof payload === "object" && typeof payload.portalError === "string") {
      const code = typeof payload.code === "string" ? payload.code : null;
      return <PageError message={payload.portalError} code={code} />;
    }
  }
  return <PageError message={GENERIC} />;
}
