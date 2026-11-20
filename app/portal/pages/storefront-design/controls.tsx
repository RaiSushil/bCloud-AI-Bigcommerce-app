import { ArrowDown, ArrowUp, Check, Plus, Sparkles, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  COLOR_KEYS,
  DEFAULT_RAIL_TITLES,
  EMPTY_COLORS,
  MAX_POPULAR_SEARCHES,
  PALETTES,
  RAIL_KEYS,
  type ColorKey,
  type Colors,
  type RailKey,
} from "../../lib/storefront-settings";

/* ------------------------------------------------------------------ */
/* Small form controls                                                 */
/* ------------------------------------------------------------------ */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="bc-dz-toggle" data-on={on} onClick={() => onChange(!on)}>
      <span aria-hidden />
    </button>
  );
}

export function Row({ label, help, children, htmlFor }: { label: string; help?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="bc-dz-row">
      <label className="bc-dz-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help && <p className="bc-dz-help">{help}</p>}
    </div>
  );
}

export function ToggleRow({ label, help, on, onChange }: { label: string; help?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bc-dz-row is-toggle">
      <div>
        <span className="bc-dz-label">{label}</span>
        {help && <p className="bc-dz-help">{help}</p>}
      </div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

export function RangeRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <div className="bc-dz-range">
        <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <output htmlFor={id}>{value}</output>
      </div>
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* Layout picker with small drawings                                   */
/* ------------------------------------------------------------------ */

export function LayoutPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="bc-dz-row">
      <span className="bc-dz-label">{label}</span>
      <div className="bc-dz-layouts" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`bc-dz-layout${value === o.value ? " is-on" : ""}`}
            onClick={() => onChange(o.value)}
          >
            <LayoutIcon name={o.icon} />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 64 x 44 schematic drawings. Lines use currentColor; the accent parts use the picker's highlight. */
function LayoutIcon({ name }: { name: string }) {
  const box = (x: number, y: number, w: number, h: number, accent = false, r = 2) => (
    <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} rx={r} className={accent ? "a" : "b"} />
  );
  let body: ReactNode;
  switch (name) {
    case "ac-panel":
      body = (
        <>
          {box(16, 4, 32, 6, false, 3)}
          {box(4, 13, 56, 27, true, 3)}
          {box(8, 17, 14, 3)}
          {box(8, 23, 12, 3)}
          {box(26, 17, 9, 10)}
          {box(37, 17, 9, 10)}
          {box(48, 17, 9, 10)}
          {box(8, 32, 49, 4)}
        </>
      );
      break;
    case "ac-dropdown":
      body = (
        <>
          {box(14, 4, 36, 6, false, 3)}
          {box(14, 12, 36, 28, true, 3)}
          {box(18, 16, 28, 3)}
          {box(18, 22, 24, 3)}
          {box(18, 28, 26, 3)}
          {box(18, 34, 20, 3)}
        </>
      );
      break;
    case "ac-full":
      body = (
        <>
          {box(2, 2, 60, 40, true, 3)}
          {box(8, 6, 48, 6, false, 3)}
          {box(8, 16, 18, 3)}
          {box(8, 22, 14, 3)}
          {box(30, 16, 12, 12)}
          {box(44, 16, 12, 12)}
          {box(8, 32, 48, 4)}
        </>
      );
      break;
    case "grid":
      body = (
        <>
          {box(6, 4, 24, 17, true)}
          {box(34, 4, 24, 17, true)}
          {box(6, 24, 24, 17, true)}
          {box(34, 24, 24, 17, true)}
        </>
      );
      break;
    case "carousel":
      body = (
        <>
          {box(2, 10, 16, 24, true)}
          {box(20, 10, 16, 24, true)}
          {box(38, 10, 16, 24, true)}
          {box(56, 10, 8, 24, true)}
          <circle cx="58" cy="22" r="5" className="b" />
        </>
      );
      break;
    case "list":
      body = (
        <>
          {[4, 18, 32].map((y) => (
            <g key={y}>
              {box(6, y, 10, 9, true)}
              {box(20, y + 2, 32, 3)}
              {box(20, y + 6, 18, 2)}
            </g>
          ))}
        </>
      );
      break;
    case "switcher":
      body = (
        <>
          {box(3, 3, 58, 38, false, 4)}
          {box(8, 7, 18, 4)}
          <circle cx="48" cy="9" r="3" className="a" />
          <circle cx="56" cy="9" r="3" className="a" />
          {box(8, 15, 22, 22, true)}
          {box(34, 15, 22, 22, true)}
        </>
      );
      break;
    case "tabs":
      body = (
        <>
          {box(4, 4, 16, 6, true, 3)}
          {box(23, 4, 16, 6, false, 3)}
          {box(42, 4, 16, 6, false, 3)}
          {box(4, 15, 17, 25, true)}
          {box(24, 15, 17, 25, true)}
          {box(44, 15, 17, 25, true)}
        </>
      );
      break;
    case "rec-columns":
      body = (
        <>
          {[3, 23, 43].map((x) => (
            <g key={x}>
              {box(x, 4, 18, 36, false, 3)}
              {box(x + 3, 8, 10, 3)}
              {box(x + 3, 14, 12, 7, true)}
              {box(x + 3, 24, 12, 7, true)}
              {box(x + 3, 34, 12, 3, true)}
            </g>
          ))}
        </>
      );
      break;
    case "rows":
      body = (
        <>
          {box(4, 3, 18, 3)}
          {[4, 19, 34, 49].map((x) => box(x, 8, 12, 12, true))}
          {box(4, 24, 18, 3)}
          {[4, 19, 34, 49].map((x) => box(x, 29, 12, 12, true))}
        </>
      );
      break;
    case "c-buttons":
      body = (
        <>
          {[4, 25].map((y) =>
            [4, 34].map((x) => (
              <g key={`${x}${y}`}>
                {box(x, y, 26, 15, false, 3)}
                {box(x + 3, y + 3, 9, 9, true)}
              </g>
            )),
          )}
        </>
      );
      break;
    case "c-tiles":
      body = (
        <>
          {box(4, 4, 17, 30, true)}
          {box(24, 4, 17, 30, true)}
          {box(44, 4, 17, 30, true)}
          {box(4, 37, 12, 3)}
          {box(24, 37, 12, 3)}
          {box(44, 37, 12, 3)}
        </>
      );
      break;
    case "c-chips":
      body = (
        <>
          {box(4, 8, 18, 8, true, 4)}
          {box(25, 8, 14, 8, true, 4)}
          {box(42, 8, 18, 8, true, 4)}
          {box(4, 22, 14, 8, true, 4)}
          {box(21, 22, 20, 8, true, 4)}
        </>
      );
      break;
    case "chat-sidebar":
      body = (
        <>
          {box(2, 2, 60, 40, false, 3)}
          {box(40, 2, 22, 40, true, 3)}
          {box(6, 8, 28, 4)}
          {box(6, 16, 28, 14)}
        </>
      );
      break;
    case "chat-drawer":
      body = (
        <>
          <rect x="2" y="2" width="60" height="40" rx="3" className="dim" />
          {box(36, 2, 26, 40, true, 3)}
        </>
      );
      break;
    case "chat-popup":
      body = (
        <>
          {box(2, 2, 60, 40, false, 3)}
          {box(36, 6, 22, 26, true, 4)}
          <circle cx="54" cy="37" r="4" className="a" />
        </>
      );
      break;
    case "side-right":
    case "side-left": {
      const x = name === "side-right" ? 46 : 4;
      body = (
        <>
          {box(2, 2, 60, 40, false, 3)}
          <circle cx={x + 7} cy="34" r="5" className="a" />
        </>
      );
      break;
    }
    case "btn-pill":
      body = (
        <>
          {box(2, 2, 60, 40, false, 3)}
          {box(30, 28, 28, 10, true, 5)}
        </>
      );
      break;
    case "btn-icon":
      body = (
        <>
          {box(2, 2, 60, 40, false, 3)}
          <circle cx="52" cy="33" r="6" className="a" />
        </>
      );
      break;
    case "btn-none":
      body = box(2, 2, 60, 40, false, 3);
      break;
    case "f-sidebar":
      body = (
        <>
          {box(4, 4, 14, 36, true)}
          {[22, 36, 50].map((x) => box(x, 4, 11, 16, false))}
          {[22, 36, 50].map((x) => box(x, 24, 11, 16, false))}
        </>
      );
      break;
    case "f-top":
      body = (
        <>
          {box(4, 4, 14, 6, true, 3)}
          {box(21, 4, 14, 6, true, 3)}
          {box(38, 4, 14, 6, true, 3)}
          {[4, 20, 36, 52].map((x) => box(x, 14, 10, 12, false))}
          {[4, 20, 36, 52].map((x) => box(x, 29, 10, 12, false))}
        </>
      );
      break;
    case "f-drawer":
      body = (
        <>
          <rect x="2" y="2" width="60" height="40" rx="3" className="dim" />
          {box(2, 2, 22, 40, true, 3)}
        </>
      );
      break;
    case "f-none":
      body = (
        <>
          {[4, 20, 36, 52].map((x) => box(x, 6, 10, 15, false))}
          {[4, 20, 36, 52].map((x) => box(x, 24, 10, 15, false))}
        </>
      );
      break;
    case "align-left":
    case "align-center": {
      const x = name === "align-left" ? 4 : 12;
      body = (
        <>
          {box(x, 8, 26, 4)}
          {box(x, 15, 40, 3)}
          {box(x, 24, 40, 10, true, 5)}
        </>
      );
      break;
    }
    case "r-soft":
    case "r-sharp":
    case "r-round": {
      const r = name === "r-sharp" ? 0 : name === "r-soft" ? 5 : 11;
      body = (
        <>
          {box(8, 6, 22, 32, true, r)}
          {box(34, 6, 22, 32, true, r)}
        </>
      );
      break;
    }
    default:
      body = box(4, 4, 56, 36, true);
  }
  return (
    <svg viewBox="0 0 64 44" aria-hidden className="bc-dz-icon">
      {body}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Popular searches editor                                             */
/* ------------------------------------------------------------------ */

export function SearchesEditor({ value, onChange, topSearches }: { value: string[]; onChange: (v: string[]) => void; topSearches: string[] }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const full = value.length >= MAX_POPULAR_SEARCHES;
  const add = () => {
    const q = draft.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!q || full || value.some((v) => v.toLowerCase() === q.toLowerCase())) return setDraft("");
    onChange([...value, q]);
    setDraft("");
  };
  const fresh = topSearches.filter((t) => !value.some((v) => v.toLowerCase() === t.toLowerCase()));
  return (
    <div className="bc-dz-row">
      <label className="bc-dz-label" htmlFor={id}>
        Popular searches <span className="bc-dz-count">{value.length} / {MAX_POPULAR_SEARCHES}</span>
      </label>
      {value.length > 0 && (
        <ul className="bc-dz-chips">
          {value.map((q) => (
            <li key={q}>
              {q}
              <button type="button" aria-label={`Remove ${q}`} onClick={() => onChange(value.filter((v) => v !== q))}>
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="bc-dz-add">
        <input
          id={id}
          className="bc-input is-sm"
          value={draft}
          maxLength={60}
          placeholder="Add a search"
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="bc-btn-soft is-sm" onClick={add} disabled={full || !draft.trim()}>
          <Plus aria-hidden /> Add
        </button>
      </div>
      {fresh.length > 0 ? (
        <div className="bc-dz-top">
          <p className="bc-dz-help">
            Your top searches in bCloud. They are words shoppers typed, so add only the ones you want every shopper to see.
          </p>
          <div className="bc-dz-topchips">
            {fresh.map((q) => (
              <button key={q} type="button" disabled={full} onClick={() => onChange([...value, q].slice(0, MAX_POPULAR_SEARCHES))}>
                <Plus aria-hidden /> {q}
              </button>
            ))}
          </div>
          <button type="button" className="bc-dz-linkbtn" disabled={full} onClick={() => onChange([...value, ...fresh].slice(0, MAX_POPULAR_SEARCHES))}>
            <Sparkles aria-hidden /> Add all
          </button>
        </div>
      ) : (
        <p className="bc-dz-help">
          {topSearches.length ? "Your top searches from bCloud are all in the list." : "Your top searches from bCloud appear here once shoppers have searched."}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recommendation lists: which ones, in what order, with what title     */
/* ------------------------------------------------------------------ */

const RAIL_INFO: Record<RailKey, string> = {
  for_you: "From this shopper's views and clicks",
  deals: "Reduced products",
  trending: "Most acted on right now",
  pick_up: "Their cart and wishlist",
  continue_shopping: "What they looked at",
  recent_searches: "Searches they made, kept in their browser",
};

export function RailsEditor({
  rails,
  titles,
  onChange,
}: {
  rails: RailKey[];
  titles: Record<RailKey, string>;
  onChange: (rails: RailKey[], titles: Record<RailKey, string>) => void;
}) {
  const order: RailKey[] = [...rails, ...RAIL_KEYS.filter((k) => !rails.includes(k))];
  const move = (key: RailKey, dir: -1 | 1) => {
    const i = rails.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rails.length) return;
    const next = [...rails];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next, titles);
  };
  return (
    <div className="bc-dz-row">
      <span className="bc-dz-label">Lists and their titles</span>
      <ul className="bc-dz-rails">
        {order.map((key) => {
          const on = rails.includes(key);
          const i = rails.indexOf(key);
          return (
            <li key={key} className={on ? "" : "is-off"}>
              <Toggle
                on={on}
                label={`Show ${DEFAULT_RAIL_TITLES[key]}`}
                onChange={(v) => {
                  const next = v ? [...rails, key] : rails.filter((k) => k !== key);
                  if (next.length) onChange(next, titles);
                }}
              />
              <div className="bc-dz-rail-text">
                <input
                  className="bc-input is-sm"
                  value={titles[key]}
                  maxLength={40}
                  aria-label={`Title for ${DEFAULT_RAIL_TITLES[key]}`}
                  onChange={(e) => onChange(rails, { ...titles, [key]: e.target.value })}
                />
                <span>{RAIL_INFO[key]}</span>
              </div>
              <div className="bc-dz-rail-move">
                <button type="button" aria-label="Move up" disabled={!on || i === 0} onClick={() => move(key, -1)}>
                  <ArrowUp aria-hidden />
                </button>
                <button type="button" aria-label="Move down" disabled={!on || i === rails.length - 1} onClick={() => move(key, 1)}>
                  <ArrowDown aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Colour palette: ready-made sets, then each colour on its own         */
/* ------------------------------------------------------------------ */

const COLOR_INFO: { group: string; items: { key: ColorKey; label: string; fallback: string }[] }[] = [
  {
    group: "Text",
    items: [
      { key: "heading", label: "Headings", fallback: "#1a1a1a" },
      { key: "eyebrow", label: "Small line above headings", fallback: "#1f4fd6" },
      { key: "text", label: "Text", fallback: "#1a1a1a" },
      { key: "muted", label: "Secondary text (hints, counts)", fallback: "#6b7280" },
    ],
  },
  {
    group: "Buttons",
    items: [
      { key: "buttonBg", label: "Button", fallback: "#1f4fd6" },
      { key: "buttonText", label: "Button text", fallback: "#ffffff" },
    ],
  },
  {
    group: "Product cards",
    items: [
      { key: "cardBg", label: "Card background", fallback: "#ffffff" },
      { key: "cardBorder", label: "Card border", fallback: "#e5e5e5" },
      { key: "price", label: "Price", fallback: "#1a1a1a" },
      { key: "salePrice", label: "Sale price", fallback: "#c4161c" },
      { key: "badgeBg", label: "Sale badge", fallback: "#c4161c" },
      { key: "badgeText", label: "Sale badge text", fallback: "#ffffff" },
    ],
  },
  {
    group: "Panels",
    items: [{ key: "surface", label: "Suggestions, assistant, filters and dialogs", fallback: "#ffffff" }],
  },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Which ready-made set the current colours are, if any. */
function currentPalette(accent: string, colors: Colors): string {
  const match = PALETTES.find(
    (p) => p.accent.toLowerCase() === accent.toLowerCase() && COLOR_KEYS.every((k) => (p.colors[k] ?? "").toLowerCase() === (colors[k] ?? "").toLowerCase()),
  );
  return match ? match.id : "";
}

export function PaletteEditor({ accent, colors, onChange }: { accent: string; colors: Colors; onChange: (accent: string, colors: Colors) => void }) {
  const active = currentPalette(accent, colors);
  const setColor = (key: ColorKey, value: string) => onChange(accent, { ...colors, [key]: value });
  return (
    <>
      <div className="bc-dz-row">
        <span className="bc-dz-label">Colour sets</span>
        <div className="bc-dz-palettes" role="radiogroup" aria-label="Colour sets">
          {PALETTES.map((p) => {
            const full = { ...EMPTY_COLORS, ...p.colors };
            const swatches = [p.accent, full.heading || "#1a1a1a", full.buttonBg || p.accent, full.cardBg || "#ffffff", full.salePrice || "#c4161c"];
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active === p.id}
                className={`bc-dz-palette${active === p.id ? " is-on" : ""}`}
                onClick={() => onChange(p.accent, full)}
              >
                <span className="bc-dz-swatches" aria-hidden>
                  {swatches.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
                <span>{p.label}</span>
                {active === p.id && <Check aria-hidden className="bc-dz-palette-check" />}
              </button>
            );
          })}
        </div>
        <p className="bc-dz-help">Pick a set, then change any colour below. Theme colours clears every colour, so your theme&apos;s colours apply.</p>
      </div>
      <ColorRow label="Accent (links, highlights, active items)" value={accent} fallback="#1f4fd6" required onChange={(v) => onChange(v || "#1f4fd6", colors)} />
      {COLOR_INFO.map((g) => (
        <div key={g.group} className="bc-dz-colorgroup">
          <h3 className="bc-dz-sub">{g.group}</h3>
          {g.items.map((c) => (
            <ColorRow key={c.key} label={c.label} value={colors[c.key]} fallback={c.fallback} onChange={(v) => setColor(c.key, v)} />
          ))}
        </div>
      ))}
    </>
  );
}

function ColorRow({ label, value, fallback, required, onChange }: { label: string; value: string; fallback: string; required?: boolean; onChange: (v: string) => void }) {
  const id = useId();
  const set = !!value;
  return (
    <div className="bc-dz-colorrow">
      <label htmlFor={id}>{label}</label>
      <div className="bc-dz-color">
        <input id={id} type="color" value={set ? value : fallback} onChange={(e) => onChange(e.target.value.toLowerCase())} aria-label={label} className={set ? "" : "is-unset"} />
        <input
          className="bc-input is-sm is-mono"
          defaultValue={value}
          key={value}
          maxLength={7}
          placeholder={required ? fallback : "Theme"}
          aria-label={`${label} (hex)`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v && !required) onChange("");
            else if (HEX.test(v)) onChange(v.toLowerCase());
          }}
        />
        {set && !required && (
          <button type="button" className="bc-dz-clear" aria-label={`Use the theme's colour for ${label}`} onClick={() => onChange("")}>
            <X aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
