/**
 * HS256 JSON Web Tokens with node:crypto (no extra dependency).
 *
 * Two uses:
 * - BigCommerce's signed_payload_jwt on /load, /uninstall and /remove_user, signed with the
 *   app's client secret (HS256, issuer "bc", audience = client id).
 * - The app's own session cookie, signed with SESSION_SECRET.
 *
 * Only HS256 is accepted: a token naming any other algorithm (including "none") is refused.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export class JwtError extends Error {
  constructor(public readonly reason: "malformed" | "algorithm" | "signature" | "expired" | "not_yet_valid" | "audience" | "issuer") {
    super(`jwt_${reason}`);
    this.name = "JwtError";
  }
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function sign(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Signs `payload` (iat and exp are the caller's job). */
export function signHs256(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${sign(`${head}.${body}`, secret).toString("base64url")}`;
}

export interface VerifyOptions {
  audience?: string;
  issuer?: string;
  /** Seconds of clock difference allowed on exp and nbf. */
  leeway?: number;
  /** Seconds since epoch (tests). */
  now?: number;
  /** When true, a token without exp is refused. */
  requireExp?: boolean;
}

/** Verifies signature, algorithm and time claims; returns the payload. Throws JwtError. */
export function verifyHs256(token: string, secret: string, opts: VerifyOptions = {}): Record<string, unknown> {
  if (typeof token !== "string" || token.length > 8_192) throw new JwtError("malformed");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]*$/.test(p))) throw new JwtError("malformed");
  const [head, body, sig] = parts;

  let header: { alg?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new JwtError("malformed");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new JwtError("malformed");
  if (header?.alg !== "HS256") throw new JwtError("algorithm");

  const expected = sign(`${head}.${body}`, secret);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new JwtError("signature");

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const leeway = opts.leeway ?? 30;
  const exp = payload.exp;
  if (exp === undefined) {
    if (opts.requireExp !== false) throw new JwtError("expired");
  } else if (typeof exp !== "number" || now - leeway >= exp) throw new JwtError("expired");
  const nbf = payload.nbf;
  if (nbf !== undefined && (typeof nbf !== "number" || now + leeway < nbf)) throw new JwtError("not_yet_valid");

  if (opts.issuer !== undefined && payload.iss !== opts.issuer) throw new JwtError("issuer");
  if (opts.audience !== undefined) {
    const aud = payload.aud;
    const ok = typeof aud === "string" ? aud === opts.audience : Array.isArray(aud) && aud.includes(opts.audience);
    if (!ok) throw new JwtError("audience");
  }
  return payload;
}
