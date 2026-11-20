/**
 * Headers for pages shown inside the BigCommerce control panel iframe, and the small page the
 * BigCommerce callbacks show when something is wrong.
 */

/** Only the BigCommerce control panel may frame the app. */
export const FRAME_ANCESTORS = "frame-ancestors https://*.mybigcommerce.com https://*.bigcommerce.com";

export function addFrameHeaders(headers: Headers): void {
  headers.set("Content-Security-Policy", FRAME_ANCESTORS);
  headers.delete("X-Frame-Options");
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain message page (install or open failed). Never includes upstream details. */
export function messagePage(title: string, message: string, status: number, headers: HeadersInit = {}): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f5fb;color:#1d1b2e}main{max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #e3e2e8;border-radius:14px}h1{font-size:20px;margin:0 0 8px}p{margin:0;line-height:1.5;color:#4b4862}</style></head>
<body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`;
  const h = new Headers(headers);
  h.set("Content-Type", "text/html; charset=utf-8");
  h.set("Cache-Control", "no-store");
  addFrameHeaders(h);
  return new Response(html, { status, headers: h });
}
