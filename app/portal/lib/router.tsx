/**
 * React Router, with every portal path kept inside the current store.
 *
 * Portal pages live at /store/{hash}/app/... (the store is in the URL so several stores can be
 * open in different tabs). The pages are the same as the Shopify app's and link to "/app/...";
 * these wrappers add "/store/{hash}" from the current URL. Portal components import Link, NavLink,
 * useNavigate and useFetcher from here, not from "react-router"; the few other hooks they use are
 * re-exported unchanged.
 */
import { forwardRef, useCallback, useMemo, type ComponentProps } from "react";
import * as RR from "react-router";

export { useLocation, useNavigation, useRevalidator, useSubmit } from "react-router";

/** "/store/abc123" on a portal page, "" elsewhere. */
export function useStoreBase(): string {
  const { storeHash } = RR.useParams();
  return storeHash ? `/store/${storeHash}` : "";
}

const isAppPath = (to: string) => to === "/app" || to.startsWith("/app/") || to.startsWith("/app?") || to.startsWith("/app#");

/** Adds the store to "/app..." paths; leaves everything else (relative paths, other routes, objects) alone. */
export function withStore<T>(base: string, to: T): T {
  if (!base) return to;
  if (typeof to === "string") return (isAppPath(to) ? base + to : to) as T;
  if (to && typeof to === "object" && "pathname" in to) {
    const p = (to as { pathname?: unknown }).pathname;
    if (typeof p === "string" && isAppPath(p)) return { ...to, pathname: base + p };
  }
  return to;
}

/** The path inside the store: "/store/abc123/app/products" -> "/app/products". */
export function appPathOf(pathname: string): string {
  return pathname.replace(/^\/store\/[^/]+(?=\/app(?:\/|$))/, "");
}

export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof RR.Link>>(function Link(props, ref) {
  const base = useStoreBase();
  return <RR.Link ref={ref} {...props} to={withStore(base, props.to)} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof RR.NavLink>>(function NavLink(props, ref) {
  const base = useStoreBase();
  return <RR.NavLink ref={ref} {...props} to={withStore(base, props.to)} />;
});

export function useNavigate(): RR.NavigateFunction {
  const navigate = RR.useNavigate();
  const base = useStoreBase();
  const go = useCallback(
    (to: RR.To | number, options?: RR.NavigateOptions) => (typeof to === "number" ? navigate(to) : navigate(withStore(base, to), options)),
    [navigate, base],
  );
  return go as RR.NavigateFunction;
}

export function useFetcher<T = unknown>(opts?: Parameters<typeof RR.useFetcher>[0]): ReturnType<typeof RR.useFetcher<T>> {
  const fetcher = RR.useFetcher<T>(opts);
  const base = useStoreBase();
  const { load, submit } = fetcher;
  const wrappedLoad = useCallback((href: string, o?: Parameters<typeof load>[1]) => load(withStore(base, href), o), [load, base]);
  const wrappedSubmit = useCallback(
    (target: Parameters<typeof submit>[0], o?: Parameters<typeof submit>[1]) =>
      submit(target, o && typeof o.action === "string" ? { ...o, action: withStore(base, o.action) } : o),
    [submit, base],
  );
  return useMemo(() => ({ ...fetcher, load: wrappedLoad, submit: wrappedSubmit }), [fetcher, wrappedLoad, wrappedSubmit]);
}
