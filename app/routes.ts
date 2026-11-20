import { prefix, type RouteConfig, type RouteConfigEntry } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

/**
 * File routes, with the portal (routes/app*.tsx) mounted under /store/:storeHash, so every
 * portal URL names its store: /store/{hash}/app/data-sync. BigCommerce's callbacks (/auth,
 * /load, /uninstall, /remove_user) and webhooks stay at the root.
 */
const routes = await flatRoutes();
const isPortal = (r: RouteConfigEntry) => r.file === "routes/app.tsx";

export default [...routes.filter((r) => !isPortal(r)), ...prefix("store/:storeHash", routes.filter(isPortal))] satisfies RouteConfig;
