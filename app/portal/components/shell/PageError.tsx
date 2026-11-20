import { CircleAlert, Plug, RotateCcw } from "lucide-react";
import { Link, useRevalidator } from "../../lib/router";

const TITLES: Record<string, string> = {
  not_connected: "Connect your bCloud account",
  bad_login: "The saved bCloud login no longer works",
  paused: "Search is paused",
  not_configured: "The bCloud connection is not set up on this server",
  signed_out: "Open the app again",
};

/** Shown inside the portal layout when a page cannot load its data. */
export function PageError({ message, code = null }: { message: string; code?: string | null }) {
  const revalidator = useRevalidator();
  const needsConnect = code === "not_connected" || code === "bad_login";
  return (
    <section className="bc-card bc-page-error" role="alert">
      {needsConnect ? <Plug aria-hidden /> : <CircleAlert aria-hidden />}
      <div>
        <h2>{(code && TITLES[code]) || "This page could not load"}</h2>
        <p>
          {code === "paused"
            ? "This store's bCloud account is paused, so no numbers can be shown. Please contact bCloud support."
            : code === "not_connected"
              ? "Link this store to its bCloud AI Search account once, and every page fills with your own numbers."
              : message}
        </p>
      </div>
      {needsConnect ? (
        <Link to="/app/connect" className="bc-btn-soft is-sm">
          <Plug aria-hidden /> {code === "bad_login" ? "Reconnect" : "Connect account"}
        </Link>
      ) : code === "paused" || code === "not_configured" || code === "signed_out" ? null : (
        <button
          type="button"
          className="bc-btn-soft is-sm"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state !== "idle"}
        >
          <RotateCcw aria-hidden /> Try again
        </button>
      )}
    </section>
  );
}
