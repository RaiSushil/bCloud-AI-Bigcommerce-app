import { CircleAlert, Laptop, Link2, Palette, RefreshCw, RotateCcw, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../../lib/router";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { useMutation } from "../../lib/useMutation";
import { DEFAULT_SETTINGS, type RailKey, type StorefrontSettings } from "../../lib/storefront-settings";
import type { DesignView } from "./types";
import { LayoutPicker, PaletteEditor, RailsEditor, RangeRow, Row, SearchesEditor, ToggleRow, Toggle } from "./controls";
import { buildPreviewDoc, memoKey, type AcState, type Device, type PreviewSeed } from "./preview";
import { getPath, SERVICES, setPath, visible, type Field, type ServiceDef, type ServiceId } from "./services";

/**
 * Storefront design: on/off, layouts and texts for every bCloud feature on the
 * online store, with a live preview of each one on the store's own data.
 * Saving writes the settings into the app's Script Manager script (bigcommerce/storefront.server.ts).
 */
export function StorefrontDesignPage({ data }: { data: DesignView }) {
  if (!data.connected) {
    return (
      <>
        <Header />
        <div className="bc-content">
          <Card title="Connect bCloud first" icon={CircleAlert}>
            <p className="bc-setup-text">The preview and the storefront use this store&apos;s bCloud account. Connect it, then come back here.</p>
            <Link className="bc-btn is-sm" to="/app/connect">
              Connect bCloud
            </Link>
          </Card>
        </div>
      </>
    );
  }
  return <Designer data={data} />;
}

function Header() {
  return (
    <PageHeader
      icon={Palette}
      title="Storefront design"
      subtitle="Turn each AI feature on or off, choose its layout and texts, and preview it with your store's real products."
    />
  );
}

function Designer({ data }: { data: DesignView }) {
  const savedJson = JSON.stringify(data.settings);
  const [settings, setSettings] = useState<StorefrontSettings>(data.settings);
  const [baseline, setBaseline] = useState(savedJson);
  const [active, setActive] = useState<ServiceId>("autocomplete");
  // What was sent with the last Save, and what the page last loaded as saved.
  const submitted = useRef("");
  const latestSaved = useRef(savedJson);
  useEffect(() => {
    latestSaved.current = savedJson;
  }, [savedJson]);
  // After a save, the reloaded page data holds what was stored (cleaned by the server). It becomes the
  // new baseline; the form takes it only if nothing was edited while saving.
  const { fetcher, busy } = useMutation(() => {
    const stored = latestSaved.current;
    setBaseline(stored);
    setSettings((current) => (JSON.stringify(current) === submitted.current ? (JSON.parse(stored) as StorefrontSettings) : current));
  });

  const dirty = JSON.stringify(settings) !== baseline || !data.saved;
  const service = SERVICES.find((s) => s.id === active) ?? SERVICES[0];
  const set = (path: string, value: unknown) => setSettings((s) => setPath(s, path, value));
  const save = () => {
    submitted.current = JSON.stringify(settings);
    fetcher.submit({ intent: "save", settings: submitted.current }, { method: "post" });
  };

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

        <div className={`bc-dz-bar${dirty ? " is-dirty" : ""}`}>
          <div className="bc-dz-master">
            <Toggle on={settings.enabled} onChange={(v) => set("enabled", v)} label="bCloud on your store" />
            <div>
              <strong>bCloud on your store</strong>
              <span>{settings.enabled ? "Features below show where they are turned on." : "Everything is off. Shoppers see your theme only."}</span>
            </div>
          </div>
          <div className="bc-dz-save">
            <span className="bc-dz-state">{!data.saved ? "Not saved yet: your store uses the defaults" : dirty ? "Unsaved changes" : "All changes saved"}</span>
            <button type="button" className="bc-btn-soft is-sm is-plain" disabled={busy || JSON.stringify(settings) === baseline} onClick={() => setSettings(JSON.parse(baseline) as StorefrontSettings)}>
              Discard
            </button>
            <button type="button" className="bc-btn is-sm" disabled={busy || !dirty} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <nav className="bc-dz-tabs" aria-label="Features">
          {SERVICES.map((s) => {
            const on = !s.toggle || (settings.enabled && (settings[s.toggle] as { enabled: boolean }).enabled);
            return (
              <button key={s.id} type="button" className={`bc-dz-tab${s.id === active ? " is-active" : ""}`} aria-current={s.id === active} onClick={() => setActive(s.id)}>
                {s.toggle && <span className={`bc-dz-dot${on ? " is-on" : ""}`} aria-label={on ? "on" : "off"} />}
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="bc-dz-main">
          <section className="bc-card bc-dz-form" aria-label={`${service.label} settings`}>
            <ServiceHead service={service} settings={settings} data={data} onToggle={(v) => service.toggle && set(`${service.toggle}.enabled`, v)} />
            <div className="bc-dz-fields">
              {service.fields.map((f, i) => (
                <FieldControl key={`${service.id}-${i}`} field={f} settings={settings} set={set} setSettings={setSettings} data={data} />
              ))}
            </div>
            <div className="bc-dz-foot">
              <button type="button" className="bc-dz-linkbtn" onClick={() => setSettings((s) => resetService(s, service.id))}>
                <RotateCcw aria-hidden /> Reset this feature to the defaults
              </button>
            </div>
          </section>

          <Preview service={service} settings={settings} data={data} />
        </div>
      </div>
    </>
  );
}

/** Puts one feature back to its defaults, keeping whether it is on or off. */
function resetService(s: StorefrontSettings, id: ServiceId): StorefrontSettings {
  if (id === "style") return { ...s, style: { ...DEFAULT_SETTINGS.style } };
  const key = id as Exclude<ServiceId, "style">;
  return { ...s, [key]: { ...DEFAULT_SETTINGS[key], enabled: s[key].enabled } };
}

function ServiceHead({ service, settings, data, onToggle }: { service: ServiceDef; settings: StorefrontSettings; data: DesignView; onToggle: (v: boolean) => void }) {
  const on = service.toggle ? (settings[service.toggle] as { enabled: boolean }).enabled : true;
  const link = service.link ? data.links[service.link] : null;
  return (
    <div className="bc-dz-head">
      <div className="bc-dz-head-top">
        <h2>{service.label}</h2>
        {service.toggle && (
          <div className="bc-dz-head-toggle">
            <span>{on ? "On" : "Off"}</span>
            <Toggle on={on} onChange={onToggle} label={`${service.label} on the store`} />
          </div>
        )}
      </div>
      <p>{service.summary}</p>
      <dl className="bc-dz-meta">
        <div>
          <dt>Where</dt>
          <dd>{service.where}</dd>
        </div>
        <div>
          <dt>bCloud API</dt>
          <dd className="is-mono">{service.api}</dd>
        </div>
      </dl>
      {service.place !== "block" && data.embedEnabled === false && (
        <p className="bc-dz-warn">
          <CircleAlert aria-hidden /> The storefront is off, so this does not show yet.{" "}
          <Link to={data.links.enableEmbed}>Turn it on</Link>
        </p>
      )}
      {service.place === "block" && link && (
        <Link className="bc-dz-addlink" to={link}>
          <Link2 aria-hidden /> How to add this widget in Page Builder
        </Link>
      )}
      {!settings.enabled && <p className="bc-dz-warn">Everything is off for your store. The preview still shows this feature.</p>}
    </div>
  );
}

function FieldControl({
  field,
  settings,
  set,
  setSettings,
  data,
}: {
  field: Field;
  settings: StorefrontSettings;
  set: (path: string, value: unknown) => void;
  setSettings: (fn: (s: StorefrontSettings) => StorefrontSettings) => void;
  data: DesignView;
}) {
  if ("when" in field && !visible(settings, field.when)) return null;
  switch (field.kind) {
    case "heading":
      return <h3 className="bc-dz-sub">{field.label}</h3>;
    case "note":
      return <p className="bc-dz-note">{field.text}</p>;
    case "toggle":
      return <ToggleRow label={field.label} help={field.help} on={!!getPath(settings, field.path)} onChange={(v) => set(field.path, v)} />;
    case "layout":
      return <LayoutPicker label={field.label} value={String(getPath(settings, field.path))} options={field.options} onChange={(v) => set(field.path, v)} />;
    case "range":
      return <RangeRow label={field.label} min={field.min} max={field.max} value={Number(getPath(settings, field.path))} onChange={(v) => set(field.path, v)} />;
    case "select":
      return (
        <Row label={field.label} help={field.help}>
          <select className="bc-select is-sm" value={String(getPath(settings, field.path))} onChange={(e) => set(field.path, field.number ? Number(e.target.value) : e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
      );
    case "text":
      return (
        <Row label={field.label} help={field.help}>
          <input className="bc-input is-sm" value={String(getPath(settings, field.path) ?? "")} maxLength={field.max} placeholder={field.placeholder} onChange={(e) => set(field.path, e.target.value)} />
        </Row>
      );
    case "color": {
      const value = String(getPath(settings, field.path));
      return (
        <Row label={field.label}>
          <div className="bc-dz-color">
            <input type="color" value={value} onChange={(e) => set(field.path, e.target.value)} aria-label={field.label} />
            <input
              className="bc-input is-sm is-mono"
              defaultValue={value}
              key={value}
              maxLength={7}
              onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && set(field.path, e.target.value.toLowerCase())}
            />
          </div>
        </Row>
      );
    }
    case "palette":
      return (
        <PaletteEditor
          accent={settings.style.accent}
          colors={settings.style.colors}
          onChange={(accent, colors) => setSettings((s) => ({ ...s, style: { ...s.style, accent, colors } }))}
        />
      );
    case "searches":
      return <SearchesEditor value={getPath(settings, field.path) as string[]} onChange={(v) => set(field.path, v)} topSearches={data.topSearches} />;
    case "rails":
      return (
        <RailsEditor
          rails={settings.recommendations.rails}
          titles={settings.recommendations.railTitles}
          onChange={(rails: RailKey[], titles) => setSettings((s) => ({ ...s, recommendations: { ...s.recommendations, rails, railTitles: titles } }))}
        />
      );
    case "category":
      return <CategoryRow label={field.label} value={String(getPath(settings, field.path) ?? "")} onChange={(v) => set(field.path, v)} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

/** Shop data the preview needs once: a product id, category names and a query that finds something. */
const seedStore: { site: string; promise: Promise<PreviewSeed & { error?: boolean }> | null; memo: Record<string, string>; categories: string[] } = {
  site: "",
  promise: null,
  memo: {},
  categories: [],
};

function loadSeed(apiBase: string, siteToken: string, fallbackQuery: string): Promise<PreviewSeed & { error?: boolean }> {
  if (seedStore.site !== `${apiBase} ${siteToken}`) {
    // Another store or bCloud address: nothing kept from before applies.
    seedStore.site = `${apiBase} ${siteToken}`;
    seedStore.promise = null;
    seedStore.memo = {};
    seedStore.categories = [];
  }
  if (seedStore.promise) return seedStore.promise;
  const url = `${apiBase}/storefront?site=${encodeURIComponent(siteToken)}`;
  seedStore.promise = fetch(url, { credentials: "omit" })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw new Error(String(res.status));
      seedStore.memo[memoKey("GET", url)] = text;
      const body = JSON.parse(text) as {
        trending?: { product_id?: string; id?: string; name?: string; category?: string | string[] }[];
        categories?: { name?: string; category?: string }[];
      };
      const first = (body.trending ?? []).find((p) => p.product_id || p.id);
      const firstCategory = Array.isArray(first?.category) ? first?.category[0] : first?.category;
      const categories = (body.categories ?? []).map((c) => String(c.name || c.category || "")).filter(Boolean);
      seedStore.categories = categories;
      return {
        productId: String(first?.product_id ?? first?.id ?? ""),
        productCategory: typeof firstCategory === "string" ? firstCategory : "",
        categories,
        query: fallbackQuery || categories[0] || first?.name || "",
      };
    })
    .catch(() => {
      seedStore.promise = null;
      return { productId: "", productCategory: "", categories: [], query: fallbackQuery, error: true };
    });
  return seedStore.promise;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function CategoryRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [cats, setCats] = useState<string[]>(seedStore.categories);
  useEffect(() => {
    if (!cats.length && seedStore.promise) seedStore.promise.then((s) => setCats(s.categories));
  }, [cats.length]);
  const options = value && !cats.includes(value) ? [value, ...cats] : cats;
  return (
    <Row label={label} help="Categories come from your bCloud catalogue.">
      <select className="bc-select is-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">The whole shop</option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </Row>
  );
}

const VIRTUAL = { desktop: { w: 1280, h: 860 }, mobile: { w: 390, h: 760 } } as const;

function Preview({ service, settings, data }: { service: ServiceDef; settings: StorefrontSettings; data: DesignView }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [acState, setAcState] = useState<AcState>("empty");
  const [seed, setSeed] = useState<(PreviewSeed & { error?: boolean }) | null>(null);
  const [query, setQuery] = useState("");
  const [nonce, setNonce] = useState(0);
  const [link, setLink] = useState<{ service: string; href: string }>({ service: "", href: "" });
  const [width, setWidth] = useState(640);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Which feature a reported link belongs to (the frame reports after a short delay).
  const serviceRef = useRef<string>(service.id);
  useEffect(() => {
    serviceRef.current = service.id;
  }, [service.id]);
  const debounced = useDebounced(settings, 350);
  const debouncedQuery = useDebounced(query, 600);
  const preview = data.preview;

  useEffect(() => {
    if (!preview) return;
    let live = true;
    loadSeed(preview.apiBase, preview.siteToken, settings.autocomplete.popularSearches[0] ?? "").then((s) => {
      if (!live) return;
      setSeed(s);
      setQuery((q) => q || s.query);
    });
    return () => {
      live = false;
    };
    // The seed is loaded once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.apiBase, preview?.siteToken, nonce]);

  // Keep bCloud's answers from the preview, so a redraw replays them instead of calling bCloud again.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const msg = e.data as { type?: string; key?: string; body?: string; href?: string };
      if (msg?.type === "bc-preview-memo" && typeof msg.key === "string" && typeof msg.body === "string") {
        // Kept answers go into every redraw of the preview, so their total size is capped.
        const total = Object.values(seedStore.memo).reduce((n, v) => n + v.length, 0);
        if (msg.key.length < 2_000 && total + msg.body.length < 1_500_000) seedStore.memo[msg.key] = msg.body;
      } else if (msg?.type === "bc-preview-link" && typeof msg.href === "string") {
        setLink({ service: serviceRef.current, href: msg.href.slice(0, 200) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const shownLink = link.service === service.id ? link.href : "";

  const doc = useMemo(() => {
    if (!preview || !seed) return "";
    return buildPreviewDoc({
      service: service.id,
      settings: debounced,
      siteToken: preview.siteToken,
      apiBase: preview.apiBase,
      shopName: data.shopName,
      currency: data.currency,
      seed,
      query: debouncedQuery,
      acState,
      memo: { ...seedStore.memo },
    });
    // nonce: "Reload" forces a fresh frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, seed, service.id, debounced, debouncedQuery, acState, data.shopName, data.currency, nonce]);

  const v = VIRTUAL[device];
  const scale = Math.min(1, width / v.w);

  return (
    <section className="bc-card bc-dz-preview" aria-label="Preview">
      <div className="bc-dz-ptools">
        <div className="bc-seg" role="radiogroup" aria-label="Device">
          <button type="button" role="radio" aria-checked={device === "desktop"} className={`bc-seg-item${device === "desktop" ? " active" : ""}`} onClick={() => setDevice("desktop")}>
            <Laptop aria-hidden /> Desktop
          </button>
          <button type="button" role="radio" aria-checked={device === "mobile"} className={`bc-seg-item${device === "mobile" ? " active" : ""}`} onClick={() => setDevice("mobile")}>
            <Smartphone aria-hidden /> Mobile
          </button>
        </div>
        {service.id === "autocomplete" && (
          <div className="bc-seg" role="radiogroup" aria-label="Search box">
            <button type="button" role="radio" aria-checked={acState === "empty"} className={`bc-seg-item${acState === "empty" ? " active" : ""}`} onClick={() => setAcState("empty")}>
              Before typing
            </button>
            <button type="button" role="radio" aria-checked={acState === "typing"} className={`bc-seg-item${acState === "typing" ? " active" : ""}`} onClick={() => setAcState("typing")}>
              While typing
            </button>
          </div>
        )}
        {(service.id === "searchResults" || (service.id === "autocomplete" && acState === "typing")) && (
          <input className="bc-input is-sm bc-dz-pquery" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words" aria-label="Search words for the preview" maxLength={100} />
        )}
        <button type="button" className="bc-btn-soft is-sm is-plain bc-dz-reload" onClick={() => setNonce((n) => n + 1)}>
          <RefreshCw aria-hidden /> Reload
        </button>
      </div>

      <div className="bc-dz-stage" ref={wrapRef}>
        {!preview ? (
          <p className="bc-dz-empty">The preview needs this store&apos;s site token. Publish it on the Storefront page first.</p>
        ) : !seed ? (
          <p className="bc-dz-empty">Loading your store&apos;s products from bCloud…</p>
        ) : seed.error ? (
          <p className="bc-dz-empty">bCloud did not answer just now, so the preview cannot load. Try Reload in a moment.</p>
        ) : (
          <div className="bc-dz-viewport" style={{ width: v.w * scale, height: v.h * scale }}>
            <iframe
              key={nonce}
              ref={frameRef}
              title={`${service.label} preview`}
              // allow-forms lets the preview's own forms (chat, search bar, price filter) fire their submit
              // handlers; every one of them prevents navigation. No allow-same-origin: no cookies, storage or parent access.
              sandbox="allow-scripts allow-forms"
              srcDoc={doc}
              style={{ width: v.w, height: v.h, transform: `scale(${scale})` }}
            />
          </div>
        )}
      </div>
      <div className="bc-dz-pfoot">
        {shownLink ? (
          <span>
            On your store this opens <code>{shownLink}</code>
          </span>
        ) : (
          <span>Click anything in the preview; links stay here.</span>
        )}
        {service.countsSearches && <span className="bc-dz-pnote">Searches you run in the preview count in your search statistics.</span>}
      </div>
    </section>
  );
}
