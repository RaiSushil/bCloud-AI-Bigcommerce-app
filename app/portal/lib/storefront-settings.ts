/**
 * Storefront settings: one JSON object per shop.
 *
 * Written by the Storefront design page and read by the storefront JavaScript (layouts and
 * texts). On BigCommerce they are kept inside the app's main Script Manager script (base64 JSON).
 *
 * Only display choices live here. No bCloud data, no tokens, no secrets.
 * `{shop}` in any text is replaced on the storefront with the shop's name.
 *
 * Shared by the server (validation before every save) and the admin page.
 */

export const SETTINGS_VERSION = 1;

/** The rails bCloud's GET /shop/storefront returns (handbook 21.7), in its own key names. */
export const BCLOUD_RAIL_KEYS = ["for_you", "deals", "trending", "pick_up", "continue_shopping"] as const;
/**
 * Lists kept in the shopper's own browser, not fetched from bCloud: the recent searches the
 * suggestions box already stores (only with the shopper's privacy consent).
 */
export const LOCAL_RAIL_KEYS = ["recent_searches"] as const;
export const RAIL_KEYS = [...BCLOUD_RAIL_KEYS, ...LOCAL_RAIL_KEYS] as const;
export type RailKey = (typeof RAIL_KEYS)[number];
/** Rails that need the shopper's own browsing (visitor id, so analytics consent). */
export const PERSONAL_RAILS: readonly RailKey[] = ["for_you", "pick_up", "continue_shopping"];

export const OPTIONS = {
  radius: ["soft", "sharp", "round"],
  imageRatio: ["square", "portrait", "landscape", "natural"],
  acLayout: ["panel", "dropdown", "fullscreen"],
  barAlign: ["left", "center"],
  resultsLayout: ["grid", "list"],
  filters: ["sidebar", "top", "drawer", "none"],
  productLayout: ["grid", "carousel", "list"],
  recLayout: ["switcher", "tabs", "rows", "columns"],
  recDisplay: ["grid", "carousel", "list"],
  listsPerRow: [3, 2],
  similarLayout: ["carousel", "grid"],
  /** ai = bCloud's vector match, text = title and description words, category = vector match inside the product's category. */
  method: ["ai", "text", "category"],
  catLayout: ["tiles", "buttons", "chips"],
  chatLayout: ["drawer", "sidebar", "popup"],
  chatProducts: ["grid", "carousel", "list"],
  side: ["right", "left"],
  launcher: ["pill", "icon", "hidden"],
  pageSize: [24, 12, 36, 48],
  mobileColumns: [2, 1],
} as const;

type Opt<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number];

/**
 * Colours the merchant can set. Empty = not set: the theme's colour (text, headings) or the
 * built-in default applies. Each becomes a CSS variable on the storefront (core.js applyStyle).
 */
export const COLOR_KEYS = [
  "heading",
  "eyebrow",
  "text",
  "muted",
  "buttonBg",
  "buttonText",
  "price",
  "salePrice",
  "badgeBg",
  "badgeText",
  "cardBg",
  "cardBorder",
  "surface",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type Colors = Record<ColorKey, string>;

/** Product rows that scroll sideways. */
export interface SliderSettings {
  arrows: boolean;
  dots: boolean;
  /** Seconds between automatic moves; 0 = never. */
  autoplay: number;
  /** After the last products, start again from the first. */
  loop: boolean;
}

export interface StorefrontSettings {
  version: typeof SETTINGS_VERSION;
  /** Master switch: off = no bCloud feature runs on the storefront. */
  enabled: boolean;
  style: {
    accent: string;
    colors: Colors;
    radius: Opt<"radius">;
    imageRatio: Opt<"imageRatio">;
    showBrand: boolean;
    showSaleBadge: boolean;
  };
  autocomplete: {
    enabled: boolean;
    layout: Opt<"acLayout">;
    placeholder: string;
    rotateExamples: boolean;
    examplePrefix: string;
    suggestionCount: number;
    showRecent: boolean;
    recentTitle: string;
    recentEmpty: string;
    showPopular: boolean;
    popularTitle: string;
    popularSearches: string[];
    showTrending: boolean;
    trendingTitle: string;
    trendingCount: number;
    showCategories: boolean;
    categoriesTitle: string;
    categoryCount: number;
    showAskAi: boolean;
  };
  searchBar: {
    enabled: boolean;
    eyebrow: string;
    heading: string;
    subheading: string;
    placeholder: string;
    buttonText: string;
    showHints: boolean;
    align: Opt<"barAlign">;
  };
  voice: { enabled: boolean; speakAnswer: boolean };
  image: { enabled: boolean };
  searchResults: {
    enabled: boolean;
    heading: string;
    layout: Opt<"resultsLayout">;
    columns: number;
    columnsMobile: Opt<"mobileColumns">;
    pageSize: Opt<"pageSize">;
    filters: Opt<"filters">;
    showOnSale: boolean;
  };
  trending: {
    enabled: boolean;
    eyebrow: string;
    heading: string;
    layout: Opt<"productLayout">;
    count: number;
    columns: number;
    columnsMobile: Opt<"mobileColumns">;
    category: string;
    showRank: boolean;
    hideWhenEmpty: boolean;
    slider: SliderSettings;
  };
  recommendations: {
    enabled: boolean;
    eyebrow: string;
    heading: string;
    layout: Opt<"recLayout">;
    display: Opt<"recDisplay">;
    /** Side by side layout: lists in one row on desktop. */
    listsPerRow: Opt<"listsPerRow">;
    rails: RailKey[];
    railTitles: Record<RailKey, string>;
    count: number;
    columns: number;
    columnsMobile: Opt<"mobileColumns">;
    hideWhenEmpty: boolean;
    slider: SliderSettings;
  };
  similar: {
    enabled: boolean;
    heading: string;
    layout: Opt<"similarLayout">;
    method: Opt<"method">;
    count: number;
    columns: number;
    columnsMobile: Opt<"mobileColumns">;
    slider: SliderSettings;
  };
  categories: {
    enabled: boolean;
    eyebrow: string;
    heading: string;
    layout: Opt<"catLayout">;
    count: number;
    columns: number;
    columnsMobile: Opt<"mobileColumns">;
    showCount: boolean;
  };
  chat: {
    enabled: boolean;
    layout: Opt<"chatLayout">;
    position: Opt<"side">;
    launcher: Opt<"launcher">;
    launcherText: string;
    title: string;
    subtitle: string;
    placeholder: string;
    showWelcome: boolean;
    showSuggestions: boolean;
    suggestionsTitle: string;
    productsPerAnswer: number;
    productLayout: Opt<"chatProducts">;
    voiceInput: boolean;
  };
}

export type ServiceKey =
  | "autocomplete"
  | "searchBar"
  | "voice"
  | "image"
  | "searchResults"
  | "trending"
  | "recommendations"
  | "similar"
  | "categories"
  | "chat";

export const DEFAULT_RAIL_TITLES: Record<RailKey, string> = {
  for_you: "Recommended for you",
  deals: "Deals",
  trending: "Trending now",
  pick_up: "Pick up where you left off",
  continue_shopping: "Recently viewed",
  recent_searches: "Your recent searches",
};

export const EMPTY_COLORS: Colors = Object.fromEntries(COLOR_KEYS.map((k) => [k, ""])) as Colors;

export const DEFAULT_SLIDER: SliderSettings = { arrows: true, dots: false, autoplay: 0, loop: false };

/**
 * Ready-made colour sets for the Look tab. "Theme" clears every colour, so the theme's own
 * colours and the built-in defaults apply again.
 */
export const PALETTES: { id: string; label: string; accent: string; colors: Partial<Colors> }[] = [
  { id: "theme", label: "Theme colours", accent: "#1f4fd6", colors: {} },
  {
    id: "ocean",
    label: "Ocean",
    accent: "#0e7490",
    colors: { heading: "#0b3a4a", text: "#1f3a44", muted: "#5b7883", buttonBg: "#0e7490", buttonText: "#ffffff", price: "#0b3a4a", salePrice: "#c2410c", badgeBg: "#c2410c", badgeText: "#ffffff", cardBg: "#ffffff", cardBorder: "#d5e7ec", surface: "#ffffff" },
  },
  {
    id: "forest",
    label: "Forest",
    accent: "#2f6b3a",
    colors: { heading: "#1e3b24", text: "#2b3a2e", muted: "#667a69", buttonBg: "#2f6b3a", buttonText: "#ffffff", price: "#1e3b24", salePrice: "#b42318", badgeBg: "#b42318", badgeText: "#ffffff", cardBg: "#fbfcf8", cardBorder: "#dfe7da", surface: "#ffffff" },
  },
  {
    id: "sunset",
    label: "Sunset",
    accent: "#e4572e",
    colors: { heading: "#3b1f14", text: "#3d2a22", muted: "#86685c", buttonBg: "#e4572e", buttonText: "#ffffff", price: "#3b1f14", salePrice: "#c81e1e", badgeBg: "#f2b134", badgeText: "#3b1f14", cardBg: "#fffaf6", cardBorder: "#f1dfd4", surface: "#fffdfb" },
  },
  {
    id: "berry",
    label: "Berry",
    accent: "#a21caf",
    colors: { heading: "#3b0f40", text: "#3a2440", muted: "#7c6683", buttonBg: "#a21caf", buttonText: "#ffffff", price: "#3b0f40", salePrice: "#be123c", badgeBg: "#be123c", badgeText: "#ffffff", cardBg: "#ffffff", cardBorder: "#eddcf0", surface: "#ffffff" },
  },
  {
    id: "mono",
    label: "Mono",
    accent: "#111111",
    colors: { heading: "#111111", text: "#222222", muted: "#6b6b6b", buttonBg: "#111111", buttonText: "#ffffff", price: "#111111", salePrice: "#111111", badgeBg: "#111111", badgeText: "#ffffff", cardBg: "#ffffff", cardBorder: "#e4e4e4", surface: "#ffffff" },
  },
  {
    id: "night",
    label: "Dark theme",
    accent: "#7c9cff",
    colors: { heading: "#f3f4f6", eyebrow: "#a5b8ff", text: "#e5e7eb", muted: "#9ca3af", buttonBg: "#7c9cff", buttonText: "#0b1020", price: "#f3f4f6", salePrice: "#fca5a5", badgeBg: "#f87171", badgeText: "#0b1020", cardBg: "#161b26", cardBorder: "#2a3242", surface: "#11151e" },
  },
];

export const DEFAULT_SETTINGS: StorefrontSettings = {
  version: SETTINGS_VERSION,
  enabled: true,
  style: { accent: "#1f4fd6", colors: { ...EMPTY_COLORS }, radius: "soft", imageRatio: "square", showBrand: false, showSaleBadge: true },
  autocomplete: {
    enabled: true,
    layout: "panel",
    placeholder: "Search {shop}",
    rotateExamples: true,
    examplePrefix: "Try:",
    suggestionCount: 6,
    showRecent: true,
    recentTitle: "Recent",
    recentEmpty: "Your searches will be kept here, so the next one is one tap away.",
    showPopular: true,
    popularTitle: "Popular searches",
    popularSearches: [],
    showTrending: true,
    trendingTitle: "Trending now",
    trendingCount: 4,
    showCategories: true,
    categoriesTitle: "Shop by category",
    categoryCount: 8,
    showAskAi: true,
  },
  searchBar: {
    enabled: true,
    eyebrow: "{shop}",
    heading: "Find what you need",
    subheading: "Search in your own words, with your voice or with a photo.",
    placeholder: "",
    buttonText: "Search",
    showHints: true,
    align: "left",
  },
  voice: { enabled: true, speakAnswer: true },
  image: { enabled: true },
  searchResults: {
    enabled: true,
    heading: "",
    layout: "grid",
    columns: 4,
    columnsMobile: 2,
    pageSize: 24,
    filters: "sidebar",
    showOnSale: true,
  },
  trending: {
    enabled: true,
    eyebrow: "Trending",
    heading: "Popular right now",
    layout: "carousel",
    count: 8,
    columns: 4,
    columnsMobile: 2,
    category: "",
    showRank: false,
    hideWhenEmpty: true,
    slider: { ...DEFAULT_SLIDER },
  },
  recommendations: {
    enabled: true,
    eyebrow: "Trending, reduced and recommended",
    heading: "Picked for you",
    layout: "switcher",
    display: "grid",
    listsPerRow: 3,
    rails: ["for_you", "deals", "trending", "continue_shopping"],
    railTitles: { ...DEFAULT_RAIL_TITLES },
    count: 4,
    columns: 4,
    columnsMobile: 2,
    hideWhenEmpty: true,
    slider: { ...DEFAULT_SLIDER },
  },
  similar: {
    enabled: true,
    heading: "You may also like",
    layout: "carousel",
    method: "category",
    count: 8,
    columns: 4,
    columnsMobile: 2,
    slider: { ...DEFAULT_SLIDER },
  },
  categories: {
    enabled: true,
    eyebrow: "",
    heading: "Shop by category",
    layout: "buttons",
    count: 8,
    columns: 4,
    columnsMobile: 2,
    showCount: false,
  },
  chat: {
    // Off until the merchant turns it on: a chat button appears on every page.
    enabled: false,
    layout: "sidebar",
    position: "right",
    launcher: "pill",
    launcherText: "Ask AI",
    title: "{shop} Assistant",
    subtitle: "Ask about any product",
    placeholder: "Ask about a product",
    showWelcome: true,
    showSuggestions: true,
    suggestionsTitle: "Try asking",
    productsPerAnswer: 4,
    productLayout: "grid",
    voiceInput: true,
  },
};

/* ------------------------------------------------------------------ */
/* Validation: every value is checked against an allowlist or clamped. */
/* ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);

function pick<T extends string | number>(v: unknown, allowed: readonly T[], d: T): T {
  return (allowed as readonly unknown[]).includes(v) ? (v as T) : d;
}

function int(v: unknown, min: number, max: number, d: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
}

/** Plain text, one line. Control characters become spaces; length is capped. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Optional text: may be empty (hides that line). Missing keeps the default. */
const text = (v: unknown, max: number, d: string): string => (typeof v === "string" ? cleanText(v, max) : d);
/** Required text (a button label, a title): empty falls back to the default. */
const label = (v: unknown, max: number, d: string): string => cleanText(v, max) || d;

const color = (v: unknown, d: string): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);

/** Every colour key, each a #rrggbb colour or "" (not set). */
function colors(v: unknown): Colors {
  const c = obj(v);
  return Object.fromEntries(COLOR_KEYS.map((k) => [k, color(c[k], "")])) as Colors;
}

function slider(v: unknown, d: SliderSettings): SliderSettings {
  const s = obj(v);
  return {
    arrows: bool(s.arrows, d.arrows),
    dots: bool(s.dots, d.dots),
    autoplay: int(s.autoplay, 0, 15, d.autoplay),
    loop: bool(s.loop, d.loop),
  };
}

export const MAX_POPULAR_SEARCHES = 10;

export function cleanSearchList(v: unknown, max = MAX_POPULAR_SEARCHES): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(v) ? v : []) {
    const s = cleanText(item, 60);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function rails(v: unknown, d: RailKey[]): RailKey[] {
  const out = (Array.isArray(v) ? v : []).filter(
    (k, i, all): k is RailKey => (RAIL_KEYS as readonly unknown[]).includes(k) && all.indexOf(k) === i,
  );
  return out.length ? out : [...d];
}

/**
 * Returns a complete, valid settings object from anything (saved JSON, a form post).
 * Unknown keys are dropped; wrong types fall back to the defaults.
 */
export function normalizeSettings(input: unknown): StorefrontSettings {
  const D = DEFAULT_SETTINGS;
  const s = obj(input);
  const st = obj(s.style);
  const ac = obj(s.autocomplete);
  const sb = obj(s.searchBar);
  const vo = obj(s.voice);
  const im = obj(s.image);
  const sr = obj(s.searchResults);
  const tr = obj(s.trending);
  const rc = obj(s.recommendations);
  const rcTitles = obj(rc.railTitles);
  const si = obj(s.similar);
  const ca = obj(s.categories);
  const ch = obj(s.chat);

  return {
    version: SETTINGS_VERSION,
    enabled: bool(s.enabled, D.enabled),
    style: {
      accent: color(st.accent, D.style.accent),
      colors: colors(st.colors),
      radius: pick(st.radius, OPTIONS.radius, D.style.radius),
      imageRatio: pick(st.imageRatio, OPTIONS.imageRatio, D.style.imageRatio),
      showBrand: bool(st.showBrand, D.style.showBrand),
      showSaleBadge: bool(st.showSaleBadge, D.style.showSaleBadge),
    },
    autocomplete: {
      enabled: bool(ac.enabled, D.autocomplete.enabled),
      layout: pick(ac.layout, OPTIONS.acLayout, D.autocomplete.layout),
      placeholder: label(ac.placeholder, 80, D.autocomplete.placeholder),
      rotateExamples: bool(ac.rotateExamples, D.autocomplete.rotateExamples),
      examplePrefix: text(ac.examplePrefix, 20, D.autocomplete.examplePrefix),
      suggestionCount: int(ac.suggestionCount, 3, 10, D.autocomplete.suggestionCount),
      showRecent: bool(ac.showRecent, D.autocomplete.showRecent),
      recentTitle: label(ac.recentTitle, 40, D.autocomplete.recentTitle),
      recentEmpty: text(ac.recentEmpty, 120, D.autocomplete.recentEmpty),
      showPopular: bool(ac.showPopular, D.autocomplete.showPopular),
      popularTitle: label(ac.popularTitle, 40, D.autocomplete.popularTitle),
      popularSearches: cleanSearchList(ac.popularSearches),
      showTrending: bool(ac.showTrending, D.autocomplete.showTrending),
      trendingTitle: label(ac.trendingTitle, 40, D.autocomplete.trendingTitle),
      trendingCount: int(ac.trendingCount, 2, 8, D.autocomplete.trendingCount),
      showCategories: bool(ac.showCategories, D.autocomplete.showCategories),
      categoriesTitle: label(ac.categoriesTitle, 40, D.autocomplete.categoriesTitle),
      categoryCount: int(ac.categoryCount, 2, 12, D.autocomplete.categoryCount),
      showAskAi: bool(ac.showAskAi, D.autocomplete.showAskAi),
    },
    searchBar: {
      enabled: bool(sb.enabled, D.searchBar.enabled),
      eyebrow: text(sb.eyebrow, 60, D.searchBar.eyebrow),
      heading: text(sb.heading, 80, D.searchBar.heading),
      subheading: text(sb.subheading, 160, D.searchBar.subheading),
      placeholder: text(sb.placeholder, 80, D.searchBar.placeholder),
      buttonText: label(sb.buttonText, 24, D.searchBar.buttonText),
      showHints: bool(sb.showHints, D.searchBar.showHints),
      align: pick(sb.align, OPTIONS.barAlign, D.searchBar.align),
    },
    voice: { enabled: bool(vo.enabled, D.voice.enabled), speakAnswer: bool(vo.speakAnswer, D.voice.speakAnswer) },
    image: { enabled: bool(im.enabled, D.image.enabled) },
    searchResults: {
      enabled: bool(sr.enabled, D.searchResults.enabled),
      heading: text(sr.heading, 80, D.searchResults.heading),
      layout: pick(sr.layout, OPTIONS.resultsLayout, D.searchResults.layout),
      columns: int(sr.columns, 2, 6, D.searchResults.columns),
      columnsMobile: pick(int(sr.columnsMobile, 1, 2, 0), OPTIONS.mobileColumns, D.searchResults.columnsMobile),
      pageSize: pick(int(sr.pageSize, 1, 48, 0), OPTIONS.pageSize, D.searchResults.pageSize),
      filters: pick(sr.filters, OPTIONS.filters, D.searchResults.filters),
      showOnSale: bool(sr.showOnSale, D.searchResults.showOnSale),
    },
    trending: {
      enabled: bool(tr.enabled, D.trending.enabled),
      eyebrow: text(tr.eyebrow, 60, D.trending.eyebrow),
      heading: text(tr.heading, 80, D.trending.heading),
      layout: pick(tr.layout, OPTIONS.productLayout, D.trending.layout),
      count: int(tr.count, 2, 12, D.trending.count),
      columns: int(tr.columns, 2, 6, D.trending.columns),
      columnsMobile: pick(int(tr.columnsMobile, 1, 2, 0), OPTIONS.mobileColumns, D.trending.columnsMobile),
      category: text(tr.category, 80, D.trending.category),
      showRank: bool(tr.showRank, D.trending.showRank),
      hideWhenEmpty: bool(tr.hideWhenEmpty, D.trending.hideWhenEmpty),
      slider: slider(tr.slider, D.trending.slider),
    },
    recommendations: {
      enabled: bool(rc.enabled, D.recommendations.enabled),
      eyebrow: text(rc.eyebrow, 60, D.recommendations.eyebrow),
      heading: text(rc.heading, 80, D.recommendations.heading),
      layout: pick(rc.layout, OPTIONS.recLayout, D.recommendations.layout),
      display: pick(rc.display, OPTIONS.recDisplay, D.recommendations.display),
      listsPerRow: pick(int(rc.listsPerRow, 2, 3, 0), OPTIONS.listsPerRow, D.recommendations.listsPerRow),
      rails: rails(rc.rails, D.recommendations.rails),
      railTitles: Object.fromEntries(
        RAIL_KEYS.map((k) => [k, label(rcTitles[k], 40, DEFAULT_RAIL_TITLES[k])]),
      ) as Record<RailKey, string>,
      count: int(rc.count, 2, 12, D.recommendations.count),
      columns: int(rc.columns, 2, 6, D.recommendations.columns),
      columnsMobile: pick(int(rc.columnsMobile, 1, 2, 0), OPTIONS.mobileColumns, D.recommendations.columnsMobile),
      hideWhenEmpty: bool(rc.hideWhenEmpty, D.recommendations.hideWhenEmpty),
      slider: slider(rc.slider, D.recommendations.slider),
    },
    similar: {
      enabled: bool(si.enabled, D.similar.enabled),
      heading: text(si.heading, 80, D.similar.heading),
      layout: pick(si.layout, OPTIONS.similarLayout, D.similar.layout),
      method: pick(si.method, OPTIONS.method, D.similar.method),
      count: int(si.count, 2, 12, D.similar.count),
      columns: int(si.columns, 2, 6, D.similar.columns),
      columnsMobile: pick(int(si.columnsMobile, 1, 2, 0), OPTIONS.mobileColumns, D.similar.columnsMobile),
      slider: slider(si.slider, D.similar.slider),
    },
    categories: {
      enabled: bool(ca.enabled, D.categories.enabled),
      eyebrow: text(ca.eyebrow, 60, D.categories.eyebrow),
      heading: text(ca.heading, 80, D.categories.heading),
      layout: pick(ca.layout, OPTIONS.catLayout, D.categories.layout),
      count: int(ca.count, 2, 24, D.categories.count),
      columns: int(ca.columns, 2, 6, D.categories.columns),
      columnsMobile: pick(int(ca.columnsMobile, 1, 2, 0), OPTIONS.mobileColumns, D.categories.columnsMobile),
      showCount: bool(ca.showCount, D.categories.showCount),
    },
    chat: {
      enabled: bool(ch.enabled, D.chat.enabled),
      layout: pick(ch.layout, OPTIONS.chatLayout, D.chat.layout),
      position: pick(ch.position, OPTIONS.side, D.chat.position),
      launcher: pick(ch.launcher, OPTIONS.launcher, D.chat.launcher),
      launcherText: label(ch.launcherText, 24, D.chat.launcherText),
      title: label(ch.title, 60, D.chat.title),
      subtitle: text(ch.subtitle, 80, D.chat.subtitle),
      placeholder: label(ch.placeholder, 60, D.chat.placeholder),
      showWelcome: bool(ch.showWelcome, D.chat.showWelcome),
      showSuggestions: bool(ch.showSuggestions, D.chat.showSuggestions),
      suggestionsTitle: label(ch.suggestionsTitle, 40, D.chat.suggestionsTitle),
      productsPerAnswer: int(ch.productsPerAnswer, 2, 6, D.chat.productsPerAnswer),
      productLayout: pick(ch.productLayout, OPTIONS.chatProducts, D.chat.productLayout),
      voiceInput: bool(ch.voiceInput, D.chat.voiceInput),
    },
  };
}

/** Is this service shown on the storefront? (master switch and its own switch) */
export function serviceOn(s: StorefrontSettings, key: ServiceKey): boolean {
  return s.enabled && s[key].enabled;
}
