import { Blocks, CheckCircle2, CircleAlert, ExternalLink, LayoutTemplate, MousePointerClick, Power, Search, Store } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "../../lib/router";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { InfoPanel } from "../../components/ui/InfoPanel";
import { Pill } from "../../components/ui/Pill";
import { useMutation } from "../../lib/useMutation";
import type { StorefrontView } from "./types";

/**
 * Data: BigCommerce's Scripts, Pages and Widgets APIs (read by the server with the store's token).
 * bCloud calls happen in the shopper's browser with the public site token.
 */
export function StorefrontPage({ data }: { data: StorefrontView }) {
  if (!data.connected) {
    return (
      <>
        <Header />
        <div className="bc-content">
          <Card title="Connect bCloud first" icon={CircleAlert}>
            <p className="bc-setup-text">
              The storefront uses this store&apos;s bCloud site token. Connect the bCloud account, then come back here.
            </p>
            <Link className="bc-btn is-sm" to="/app/connect">
              Connect bCloud
            </Link>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="bc-content">
        {data.problems.length > 0 && (
          <div className="bc-setup-alert" role="status">
            <CircleAlert aria-hidden />
            <div>
              {data.problems.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        )}

        <div className="bc-grid bc-cols-2">
          <InstallCard data={data} />
          <SearchBoxCard data={data} />
        </div>

        <WidgetsCard data={data} />

        <TrackingCard data={data} />

        <InfoPanel
          icon={Store}
          title="What runs where?"
          points={[
            "The app adds scripts in Script Manager (Storefront > Script Manager) and a hidden Search page. BigCommerce removes the scripts by itself when the app is uninstalled.",
            "Shoppers' browsers call bCloud directly with the public site token. No search goes through this app's server.",
            "The secret ingestion key and your dashboard password never reach the storefront or the browser.",
            "With BigCommerce's cookie consent banner on, tracking runs only for shoppers who allow analytics, and recent searches only for shoppers who allow functional cookies.",
            "Covered: Stencil storefronts on your default channel. Not included: headless (Catalyst) storefronts, and features bCloud does not document an API for (compare tray, Best Fit, search over FAQ or policy pages).",
          ]}
          example="A shopper types “warm jacket” in your search box → AI suggestions appear → the AI search page shows bCloud's results → their click and later purchase show on Analytics and Live activity."
        />
      </div>
    </>
  );
}

function Header() {
  return (
    <PageHeader
      icon={LayoutTemplate}
      title="Storefront"
      subtitle="Put bCloud AI search on your BigCommerce storefront: turn it on, add widgets in Page Builder, and keep tracking on."
    />
  );
}

function stateLabel(data: StorefrontView) {
  if (data.state === "on") return data.upToDate ? <Pill dot>On</Pill> : <Pill tone="amber" dot>Out of date</Pill>;
  if (data.state === "unknown") return <Pill tone="amber">Unknown</Pill>;
  return <Pill tone="amber" dot>Off</Pill>;
}

function InstallCard({ data }: { data: StorefrontView }) {
  const navigate = useNavigate();
  const { fetcher, busy } = useMutation(() => navigate(".", { replace: true }));
  const on = data.state === "on";
  const pending = fetcher.formData?.get("intent");
  return (
    <Card title="1 · Turn on the storefront" icon={Power} action={stateLabel(data)}>
      <dl className="bc-kv">
        <div>
          <dt>bCloud client</dt>
          <dd className="bc-mono-accent">{data.clientId}</dd>
        </div>
        <div>
          <dt>Site token</dt>
          <dd className="bc-mono-accent">{data.siteToken ?? "missing"}</dd>
        </div>
        <div>
          <dt>Storefront API</dt>
          <dd className="is-mono bc-setup-small">{data.apiBase ?? "—"}</dd>
        </div>
        {data.searchPage && (
          <div>
            <dt>Search page</dt>
            <dd className="is-mono bc-setup-small">
              {data.searchPage.url}
              {!data.searchPage.ready && " (missing: press Update)"}
            </dd>
          </div>
        )}
      </dl>
      <p className="bc-setup-text">
        Adds the AI search bar suggestions, voice and picture search, the AI shopping assistant and the AI search page to every
        storefront page through Script Manager. The token is public and read-only by design; you never paste it anywhere.
      </p>
      <div className="bc-connect-actions">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="on" />
          <button
            type="submit"
            className={on && data.upToDate ? "bc-btn-soft is-sm is-plain" : "bc-btn is-sm"}
            disabled={busy || !data.siteToken || data.state === "unknown"}
          >
            {busy && pending === "on" ? "Working…" : on ? (data.upToDate ? "Update again" : "Update") : "Turn on"}
          </button>
        </fetcher.Form>
        {on && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="off" />
            <button type="submit" className="bc-btn-soft is-sm is-plain" disabled={busy}>
              {busy && pending === "off" ? "Turning off…" : "Turn off"}
            </button>
          </fetcher.Form>
        )}
        {on && data.storefrontUrl && (
          <a className="bc-btn-soft is-sm is-plain" href={data.storefrontUrl} target="_blank" rel="noreferrer">
            View storefront <ExternalLink aria-hidden />
          </a>
        )}
      </div>
      {on && data.upToDate && (
        <p className="bc-setup-ok">
          <CheckCircle2 aria-hidden />
          <span>
            On for every storefront page. Layouts and texts are set on <Link to="/app/storefront-design">Storefront design</Link>.
          </span>
        </p>
      )}
      {data.state === "off" && <p className="bc-setup-text">Your saved design is kept and comes back when you turn the storefront on.</p>}
    </Card>
  );
}

/** Theme-specific selectors: the defaults fit Cornerstone and most Stencil themes. */
function SearchBoxCard({ data }: { data: StorefrontView }) {
  const navigate = useNavigate();
  const { fetcher, busy } = useMutation(() => navigate(".", { replace: true }));
  const [search, setSearch] = useState(data.selectors.search);
  const [hide, setHide] = useState(data.selectors.hide);
  const on = data.state === "on";
  return (
    <Card title="Your theme's search box" icon={Search}>
      <p className="bc-setup-text">
        AI suggestions open under the search box this selector finds. The theme&apos;s own quick-search results are hidden while
        suggestions are on. The defaults fit Cornerstone and most Stencil themes.
      </p>
      <fetcher.Form method="post" className="bc-connect-form bc-setup-form">
        <input type="hidden" name="intent" value="on" />
        <label className="bc-field">
          <span className="bc-field-label">Search box (CSS selector)</span>
          <input
            className="bc-input is-mono"
            name="selector"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={data.defaults.search}
            maxLength={300}
            spellCheck={false}
          />
        </label>
        <label className="bc-field">
          <span className="bc-field-label">Theme suggestions to hide (CSS selector)</span>
          <input
            className="bc-input is-mono"
            name="hide"
            value={hide}
            onChange={(e) => setHide(e.target.value)}
            placeholder={data.defaults.hide}
            maxLength={300}
            spellCheck={false}
          />
        </label>
        <div className="bc-connect-actions">
          <button type="submit" className="bc-btn-soft is-sm is-plain" disabled={busy || !on}>
            {busy ? "Saving…" : "Save selectors"}
          </button>
          <button
            type="button"
            className="bc-btn-soft is-sm is-plain"
            disabled={busy}
            onClick={() => {
              setSearch(data.defaults.search);
              setHide(data.defaults.hide);
            }}
          >
            Use defaults
          </button>
        </div>
      </fetcher.Form>
      {!on && <p className="bc-setup-muted">Turn the storefront on to save selectors.</p>}
    </Card>
  );
}

function WidgetsCard({ data }: { data: StorefrontView }) {
  return (
    <Card title="2 · Add widgets in Page Builder" icon={Blocks} note="drag them onto any page; layouts come from Storefront design">
      <ol className="bc-setup-text">
        <li>
          In your BigCommerce control panel open <strong>Storefront › My Themes</strong> and press <strong>Customize</strong> (Page
          Builder).
        </li>
        <li>
          Pick the page (Home page, a product page for Similar products), open <strong>Custom</strong> in the widget list and drag a
          bCloud widget where you want it.
        </li>
        <li>
          Press <strong>Publish</strong>. The widget fills with bCloud products on the live storefront (Page Builder&apos;s preview may
          stay empty).
        </li>
      </ol>
      <div className="bc-table-wrap">
        <table className="bc-table bc-setup-blocks">
          <thead>
            <tr>
              <th>Widget (Page Builder › Custom)</th>
              <th>What shoppers see</th>
              <th className="is-num">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.widgets.map((w) => (
              <tr key={w.name}>
                <td className="bc-setup-name">
                  <strong>{w.name}</strong>
                  <span>{w.where}</span>
                </td>
                <td>
                  {w.what}
                  <span className="bc-setup-api">{w.api}</span>
                </td>
                <td className="is-num">
                  {w.ready === true ? (
                    <Pill dot>Ready</Pill>
                  ) : w.ready === false ? (
                    <span className="bc-setup-muted">appears after Turn on</span>
                  ) : (
                    <span className="bc-setup-muted">unknown</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bc-setup-text bc-setup-foot">
        You do not need a widget for search results: searches from your theme&apos;s search box open the app&apos;s AI search page
        while <strong>AI search results</strong> is on in <Link to="/app/storefront-design">Storefront design</Link>.
      </p>
    </Card>
  );
}

function TrackingCard({ data }: { data: StorefrontView }) {
  const navigate = useNavigate();
  const { fetcher, busy } = useMutation(() => navigate(".", { replace: true }));
  const on = data.state === "on";
  const active = on && data.tracking;
  return (
    <Card
      title="Shopper tracking (views, add to cart, purchases)"
      icon={MousePointerClick}
      action={!on ? <Pill tone="amber">Storefront off</Pill> : active ? <Pill dot>On</Pill> : <Pill tone="amber" dot>Off</Pill>}
    >
      <p className="bc-setup-text">
        Sends product views, add to cart and completed orders to bCloud, so trending, recommendations and revenue from search use
        real data. Purchases are read on the order confirmation page, which needs BigCommerce&apos;s Optimized One-Page Checkout.
        With the cookie consent banner on, BigCommerce runs tracking only for shoppers who allow analytics.
      </p>
      <fetcher.Form method="post" className="bc-connect-actions">
        <input type="hidden" name="intent" value={active ? "tracking_off" : "tracking_on"} />
        <button type="submit" className={active ? "bc-btn-soft is-sm is-plain" : "bc-btn is-sm"} disabled={busy || !on}>
          {busy ? "Saving…" : active ? "Turn off" : "Turn on"}
        </button>
      </fetcher.Form>
    </Card>
  );
}
