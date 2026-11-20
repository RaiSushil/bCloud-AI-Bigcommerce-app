/**
 * Public entry point of the portal API layer. Routes import from here only.
 *
 *   loader/action  ->  portalApi.<page>.<call>(ctx, ...)  ->  mock data or real API
 *
 * See docs/portal-architecture.md for how to connect each API.
 */
import * as account from "./services/account.server";
import * as activity from "./services/activity.server";
import * as analytics from "./services/analytics.server";
import * as assistant from "./services/assistant.server";
import * as billing from "./services/billing.server";
import * as install from "./services/install.server";
import * as liveSync from "./services/livesync.server";
import * as missed from "./services/missed.server";
import * as overview from "./services/overview.server";
import * as products from "./services/products.server";
import * as support from "./services/support.server";
import * as sync from "./services/sync.server";
import * as synonyms from "./services/synonyms.server";

export const portalApi = {
  account: { get: account.getAccount, changePassword: account.changePassword },
  overview: { get: overview.getOverview, isReportAvailable: overview.isReportAvailable, doctor: overview.integrationDoctor },
  liveSync: { get: liveSync.getLiveSync },
  analytics: {
    get: analytics.getAnalytics,
    parseDoor: analytics.parseDoor,
    parseRange: analytics.parseRange,
  },
  liveActivity: { get: activity.getLiveActivity, parseFilter: activity.parseActivityFilter },
  missedSearches: { get: missed.getMissedSearches, connect: missed.connectMissedWord },
  products: { get: products.getProducts, parseQuery: products.parseProductsQuery },
  dataSync: { get: sync.getDataSync },
  synonyms: {
    get: synonyms.getSynonyms,
    add: synonyms.addSynonym,
    remove: synonyms.removeSynonym,
  },
  billing: { get: billing.getBilling },
  install: { get: install.getInstall, preview: install.previewSearch },
  support: {
    get: support.getSupport,
    create: support.createTicket,
    update: support.updateTicket,
  },
  assistant: { ask: assistant.askAssistant, parseHistory: assistant.parseHistory },
};

export { getPortalContext } from "./context.server";
export { PortalApiError, type PortalContext } from "./http.server";
export { PASSWORD_MIN_LENGTH } from "./services/account.server";
export { LIVE_SYNC_POLL_MS } from "./services/livesync.server";
export { SYNONYM_LIMIT } from "./services/synonyms.server";
export { TICKET_PRIORITIES } from "./services/support.server";
export * from "./types";
