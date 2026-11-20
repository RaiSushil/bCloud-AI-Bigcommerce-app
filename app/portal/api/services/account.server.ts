import { forgetToken } from "../auth/session.server";
import { updateStoredPassword } from "../auth/connection.server";
import type { BcMe } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, PortalApiError, type PortalContext } from "../http.server";
import { mockAccount } from "../mock/account.mock";
import { mockState } from "../mock/store.server";
import type { AccountSummary, MutationResult } from "../types";
import { str } from "./shared.server";

export const PORTAL_URL = "https://portal.bcloudai.com";

/**
 * REQUIRES VERIFICATION: the document shows `plan` only as "{ ... }".
 * A string, or an object with a string `name`, is used; otherwise no label.
 */
export function planLabel(plan: unknown): string | null {
  if (typeof plan === "string" && plan) return plan;
  if (plan && typeof plan === "object" && typeof (plan as { name?: unknown }).name === "string") {
    return (plan as { name: string }).name;
  }
  return null;
}

export function mapMe(raw: BcMe): AccountSummary {
  return {
    companyName: raw.name || raw.client_id,
    clientId: raw.client_id,
    // A paused client cannot sign in at all, so a successful call means active.
    status: "active",
    memberSince: str(raw.created_at),
    productsLive: raw.products ?? 0,
    lastSearchAt: str(raw.doctor?.last_search_at),
    lastProductSyncAt: str(raw.doctor?.last_sync?.finished_at),
    siteToken: raw.site_token ?? "",
    portalUrl: PORTAL_URL,
    planLabel: planLabel(raw.plan),
  };
}

export async function getMe(ctx: PortalContext): Promise<BcMe> {
  return apiRequest<BcMe>(ctx, "account");
}

export async function getAccount(ctx: PortalContext): Promise<AccountSummary> {
  if (!usesApi("account")) return mockAccount();
  return mapMe(await getMe(ctx));
}

export const PASSWORD_MIN_LENGTH = 10; // Client Dashboard API, POST /change-password
export const PASSWORD_MAX_LENGTH = 200; // same cap as the Connect page

export async function changePassword(
  ctx: PortalContext,
  input: { current: string; next: string; confirm: string },
): Promise<MutationResult> {
  if (!input.current) return { ok: false, error: "Enter your current password.", field: "current" };
  if (input.next.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `The new password needs at least ${PASSWORD_MIN_LENGTH} characters.`, field: "next" };
  }
  if (input.next !== input.confirm) {
    return { ok: false, error: "The two new passwords do not match.", field: "confirm" };
  }
  if (input.next.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Keep the password under ${PASSWORD_MAX_LENGTH} characters.`, field: "next" };
  }
  if (input.next === input.current) {
    return { ok: false, error: "Choose a password you have not used here.", field: "next" };
  }

  if (!usesApi("account")) {
    mockState().passwordChangedAt = new Date().toISOString();
    return { ok: true, message: "Password changed (static mode, nothing was sent)." };
  }

  try {
    await apiRequest(ctx, "changePassword", {
      body: { old_password: input.current, new_password: input.next },
    });
  } catch (error) {
    // 401 here means the current password was wrong (the token is still valid).
    if (error instanceof PortalApiError && error.endpoint === "changePassword" && error.status === 401) {
      return { ok: false, error: "The current password is not correct.", field: "current" };
    }
    throw error;
  }
  // The app signs in with this password, so our stored copy must follow.
  try {
    await updateStoredPassword(ctx.shop, input.next);
  } catch {
    forgetToken(ctx.shop);
    return {
      ok: false,
      error: "Your password was changed at bCloud, but the app could not save it. Please reconnect with the new password.",
    };
  }
  forgetToken(ctx.shop);
  return { ok: true, message: "Password changed. The app now uses the new password." };
}
