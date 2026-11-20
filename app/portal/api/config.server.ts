/**
 * Portal data configuration (server only).
 *
 *   PORTAL_DATA_SOURCE=mock   every page uses the static data in api/mock/   (default)
 *   PORTAL_DATA_SOURCE=api    every page calls the real API through http.server.ts
 *
 *   PORTAL_API_SERVICES=overview,analytics
 *     Optional. While PORTAL_DATA_SOURCE=mock, the services listed here already
 *     use the real API. This lets you connect the APIs one page at a time.
 */

export type DataSource = "mock" | "api";

/** One name per service file in api/services/. */
export type ServiceName =
  | "account"
  | "overview"
  | "analytics"
  | "liveActivity"
  | "missedSearches"
  | "products"
  | "dataSync"
  | "synonyms"
  | "billing"
  | "install"
  | "support"
  | "assistant"
  | "liveSync";

export interface PortalConfig {
  source: DataSource;
  apiServices: ReadonlySet<string>;
  baseUrl: string;
  timeoutMs: number;
}

export function getPortalConfig(
  env: Record<string, string | undefined> = process.env,
): PortalConfig {
  const source: DataSource = env.PORTAL_DATA_SOURCE === "api" ? "api" : "mock";
  const apiServices = new Set(
    (env.PORTAL_API_SERVICES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const baseUrl = (env.BCLOUD_API_BASE_URL || "https://search.bcloudai.com").replace(
    /\/+$/,
    "",
  );
  const timeoutMs = Number(env.PORTAL_API_TIMEOUT_MS) || 15_000;
  return { source, apiServices, baseUrl, timeoutMs };
}

/** True when this service should call the real API instead of static data. */
export function usesApi(service: ServiceName): boolean {
  const config = getPortalConfig();
  return config.source === "api" || config.apiServices.has(service);
}
