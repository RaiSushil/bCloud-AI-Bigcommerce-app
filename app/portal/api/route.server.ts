/**
 * Helpers for route loaders and actions.
 *
 *   loader: return withPortal(request, (ctx) => portalApi.overview.get(ctx));
 *   action: return runMutation(request, (ctx) => portalApi.synonyms.add(ctx, a, b));
 *
 * API failures become a friendly error card (loaders) or an inline form
 * message (actions). Secrets and raw API errors never reach the browser.
 */
import { data } from "react-router";
import { getPortalContext } from "./context.server";
import type { PortalErrorCode } from "./errors";
import { PortalApiError, type PortalContext } from "./http.server";
import type { MutationResult } from "./types";

export interface PortalErrorData {
  portalError: string;
  code: PortalErrorCode | null;
}

export async function withPortal<T>(
  request: Request,
  load: (ctx: PortalContext) => Promise<T>,
): Promise<T> {
  const ctx = await getPortalContext(request);
  try {
    return await load(ctx);
  } catch (error) {
    if (error instanceof PortalApiError) {
      throw data<PortalErrorData>(
        { portalError: error.message, code: error.code ?? null },
        { status: error.status ?? (error.code ? 409 : 502) },
      );
    }
    throw error;
  }
}

export async function runMutation(
  request: Request,
  mutate: (ctx: PortalContext, form: FormData) => Promise<MutationResult>,
): Promise<MutationResult> {
  const ctx = await getPortalContext(request);
  const form = await request.formData();
  try {
    return await mutate(ctx, form);
  } catch (error) {
    if (error instanceof PortalApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Reads a string field from a form (empty string when missing). */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
