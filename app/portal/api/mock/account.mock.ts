import type { AccountSummary } from "../types";
import { minutesAgo } from "./time";

export function mockAccount(): AccountSummary {
  return {
    companyName: "Demo Store",
    clientId: "demo-store",
    status: "active",
    memberSince: "2026-10-11T09:00:00.000Z",
    productsLive: 17,
    lastSearchAt: minutesAgo(6),
    lastProductSyncAt: null,
    siteToken: "dEm0sItE7kn2",
    portalUrl: "https://portal.bcloudai.com",
    planLabel: "100,000 products max",
  };
}
