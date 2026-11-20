/**
 * The app's own sign-in session inside the BigCommerce control panel.
 *
 * BigCommerce opens the app in an iframe and signs the merchant in through /load (or /auth on
 * install). The app then keeps a short session in a cookie, as BigCommerce's app tutorial does:
 * httpOnly, Secure, SameSite=None and Partitioned (required inside the cross-site iframe).
 *
 * The cookie holds a JWT signed with SESSION_SECRET: the BigCommerce user id and the stores this
 * browser opened the app for. Every portal URL carries the store (/store/{hash}/app/...), so one
 * person can have several stores open in different tabs without one tab acting on another store.
 * Each request also checks the database: the store is still installed and the user was not removed.
 */
import { data } from "react-router";
import db from "../../db.server";
import { bcConfig } from "../../bigcommerce.server";
import { JwtError, signHs256, verifyHs256 } from "./jwt.server";

export const SESSION_COOKIE = "bc_app_session";
/** A session lasts this long; opening the app again from the control panel starts a new one. */
export const SESSION_TTL_SEC = 10 * 60 * 60;
const MAX_STORES = 20;

export interface AppSession {
  userId: number;
  stores: string[];
  iat: number;
}

export const STORE_HASH = /^[a-z0-9]{1,32}$/i;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** The verified session from the cookie, or null. */
export function readSession(request: Request, now = Math.floor(Date.now() / 1000)): AppSession | null {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  try {
    const p = verifyHs256(raw, bcConfig().sessionSecret, { now, leeway: 0, issuer: "bcloud-app" });
    const userId = p.sub;
    const stores = p.stores;
    const iat = p.iat;
    if (typeof userId !== "number" || !Array.isArray(stores) || typeof iat !== "number") return null;
    if (!stores.every((s) => typeof s === "string" && STORE_HASH.test(s))) return null;
    if (now - iat > SESSION_TTL_SEC) return null;
    return { userId, stores: stores as string[], iat };
  } catch (error) {
    if (error instanceof JwtError) return null;
    throw error;
  }
}

/**
 * Set-Cookie value that adds `storeHash` to this browser's session for `userId`.
 * A different user (or no session) starts a new one.
 */
export function sessionCookieFor(request: Request, userId: number, storeHash: string, now = Math.floor(Date.now() / 1000)): string {
  const current = readSession(request, now);
  const sameUser = current && current.userId === userId;
  const stores = sameUser ? [storeHash, ...current.stores.filter((s) => s !== storeHash)].slice(0, MAX_STORES) : [storeHash];
  // A new store extends nothing: the session ends at the first sign-in's time + TTL, then /load starts a fresh one.
  const iat = sameUser ? current.iat : now;
  const token = signHs256({ iss: "bcloud-app", sub: userId, stores, iat, exp: iat + SESSION_TTL_SEC }, bcConfig().sessionSecret);
  return serialize(token, Math.max(60, iat + SESSION_TTL_SEC - now));
}

/** Clears the session (e.g. after the store is uninstalled). */
export function clearSessionCookie(): string {
  return serialize("", 0);
}

function serialize(value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None; Partitioned`;
}

/** The store in a portal URL: /store/{hash}/... */
export function storeHashFromUrl(url: string): string | null {
  const m = /^\/store\/([^/]+)(?:\/|$)/.exec(new URL(url).pathname);
  return m && STORE_HASH.test(m[1]) ? m[1].toLowerCase() : null;
}

export const SIGNED_OUT_MESSAGE = "Your session has ended. Open bCloud AI Search again from Apps in your BigCommerce control panel.";

/**
 * Verifies the request for a portal page and returns the store and user.
 * Throws a 401 the page's error boundary shows as a friendly message.
 */
export async function requireStoreSession(request: Request): Promise<{ storeHash: string; userId: number }> {
  const storeHash = storeHashFromUrl(request.url);
  const session = readSession(request);
  if (!storeHash || !session || !session.stores.includes(storeHash)) throw signedOut();
  const [store, user] = await Promise.all([
    db.bcStore.findUnique({ where: { storeHash }, select: { storeHash: true } }),
    db.bcStoreUser.findUnique({ where: { storeHash_userId: { storeHash, userId: session.userId } }, select: { userId: true } }),
  ]);
  if (!store || !user) throw signedOut();
  return { storeHash, userId: session.userId };
}

function signedOut() {
  return data({ portalError: SIGNED_OUT_MESSAGE, code: "signed_out" }, { status: 401 });
}
