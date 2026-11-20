/**
 * What the Storefront design page shows for each bCloud service: its name,
 * where it appears, which bCloud API it uses, and its settings form.
 * Every service here is an existing, documented bCloud feature.
 */
import type { StorefrontSettings } from "../../lib/storefront-settings";

export type ServiceId =
  | "style"
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

/** Which link explains where to add this service (on BigCommerce: the app's Storefront page). */
export type LinkKey = "enableEmbed" | "addSearchResults" | "addSimilar" | "addRail" | "addCategories" | "addTrending" | "addSearchBar";

export type Field =
  | { kind: "heading"; label: string; when?: string }
  | { kind: "note"; text: string }
  | { kind: "toggle"; path: string; label: string; help?: string; when?: string }
  | { kind: "layout"; path: string; label: string; options: { value: string; label: string; icon: string }[]; when?: string }
  | { kind: "select"; path: string; label: string; options: { value: string | number; label: string }[]; number?: boolean; help?: string; when?: string }
  | { kind: "range"; path: string; label: string; min: number; max: number; when?: string }
  | { kind: "text"; path: string; label: string; max: number; placeholder?: string; help?: string; when?: string }
  | { kind: "color"; path: string; label: string }
  | { kind: "palette" }
  | { kind: "searches"; path: string; when?: string }
  | { kind: "rails" }
  | { kind: "category"; path: string; label: string };

export interface ServiceDef {
  id: ServiceId;
  label: string;
  /** Short sentence for the header. */
  summary: string;
  /** Where it runs: every page (the storefront script) or a Page Builder widget the merchant places. */
  place: "embed" | "block" | "all";
  where: string;
  api: string;
  link?: LinkKey;
  /** The settings key holding `enabled` (none for the shared look). */
  toggle?: keyof StorefrontSettings;
  /** The live preview runs searches that bCloud counts in the shop's statistics. */
  countsSearches?: boolean;
  fields: Field[];
}

const COLS = { kind: "range", min: 2, max: 6 } as const;
const MOBILE = [
  { value: 2, label: "2" },
  { value: 1, label: "1" },
];
const HELP_SHOP = "{shop} is replaced with your shop's name.";

/** Slider settings of a section, shown while its products are in a slider. */
function sliderFields(base: string, when: string): Field[] {
  return [
    { kind: "heading", label: "Slider", when },
    { kind: "toggle", path: `${base}.slider.arrows`, label: "Arrows", help: "Shown on computers. Phones swipe.", when },
    { kind: "toggle", path: `${base}.slider.dots`, label: "Dots under the slider", when },
    { kind: "range", path: `${base}.slider.autoplay`, label: "Move on its own every … seconds (0 = off)", min: 0, max: 15, when },
    { kind: "toggle", path: `${base}.slider.loop`, label: "Start again after the last product", when },
  ];
}

export const SERVICES: ServiceDef[] = [
  {
    id: "autocomplete",
    label: "Search suggestions",
    summary: "AI suggestions under your theme's search box, with recent and popular searches, trending products and categories.",
    place: "embed",
    where: "Every page, on your theme's search box",
    api: "GET /shop/autocomplete · /trending · /popularcat",
    link: "enableEmbed",
    toggle: "autocomplete",
    fields: [
      {
        kind: "layout",
        path: "autocomplete.layout",
        label: "Layout",
        options: [
          { value: "panel", label: "Wide panel", icon: "ac-panel" },
          { value: "dropdown", label: "Dropdown", icon: "ac-dropdown" },
          { value: "fullscreen", label: "Full screen", icon: "ac-full" },
        ],
      },
      { kind: "text", path: "autocomplete.placeholder", label: "Search box text", max: 80, help: HELP_SHOP },
      { kind: "toggle", path: "autocomplete.rotateExamples", label: "Show popular searches as examples in the box", help: "The box shows “Try: …” with one of your popular searches." },
      { kind: "text", path: "autocomplete.examplePrefix", label: "Example prefix", max: 20, when: "autocomplete.rotateExamples" },
      { ...COLS, kind: "range", path: "autocomplete.suggestionCount", label: "Suggestions while typing", min: 3, max: 10 },
      { kind: "toggle", path: "autocomplete.showAskAi", label: "Ask AI button", help: "Opens the AI assistant with the typed words. Needs the assistant on." },
      { kind: "heading", label: "Before the shopper types" },
      { kind: "toggle", path: "autocomplete.showRecent", label: "Recent searches", help: "Kept in the shopper's own browser, only when their privacy choices allow it." },
      { kind: "text", path: "autocomplete.recentTitle", label: "Recent searches title", max: 40, when: "autocomplete.showRecent" },
      { kind: "text", path: "autocomplete.recentEmpty", label: "Text when there are none yet", max: 120, when: "autocomplete.showRecent" },
      { kind: "toggle", path: "autocomplete.showPopular", label: "Popular searches" },
      { kind: "text", path: "autocomplete.popularTitle", label: "Popular searches title", max: 40, when: "autocomplete.showPopular" },
      { kind: "searches", path: "autocomplete.popularSearches", when: "autocomplete.showPopular" },
      { kind: "toggle", path: "autocomplete.showTrending", label: "Trending products" },
      { kind: "text", path: "autocomplete.trendingTitle", label: "Trending title", max: 40, when: "autocomplete.showTrending" },
      { kind: "range", path: "autocomplete.trendingCount", label: "Trending products shown", min: 2, max: 8, when: "autocomplete.showTrending" },
      { kind: "toggle", path: "autocomplete.showCategories", label: "Categories" },
      { kind: "text", path: "autocomplete.categoriesTitle", label: "Categories title", max: 40, when: "autocomplete.showCategories" },
      { kind: "range", path: "autocomplete.categoryCount", label: "Categories shown", min: 2, max: 12, when: "autocomplete.showCategories" },
    ],
  },
  {
    id: "searchBar",
    label: "AI search bar",
    summary: "A large search box for your home page, with picture search, voice search and Ask AI buttons.",
    place: "block",
    where: "A Page Builder widget you place (home page or any page)",
    api: "GET /shop/autocomplete · POST /shop/search/voice · /search/image",
    link: "addSearchBar",
    toggle: "searchBar",
    fields: [
      { kind: "text", path: "searchBar.eyebrow", label: "Small line above", max: 60, help: HELP_SHOP },
      { kind: "text", path: "searchBar.heading", label: "Heading", max: 80 },
      { kind: "text", path: "searchBar.subheading", label: "Text under the heading", max: 160 },
      { kind: "text", path: "searchBar.placeholder", label: "Search box text", max: 80, help: "Leave empty to use the text from Search suggestions." },
      { kind: "text", path: "searchBar.buttonText", label: "Search button", max: 24 },
      {
        kind: "layout",
        path: "searchBar.align",
        label: "Alignment",
        options: [
          { value: "left", label: "Left", icon: "align-left" },
          { value: "center", label: "Centre", icon: "align-center" },
        ],
      },
      { kind: "toggle", path: "searchBar.showHints", label: "Links under the box", help: "“Search with a photo”, “Say it” and Ask AI." },
    ],
  },
  {
    id: "voice",
    label: "Voice search",
    summary: "Shoppers say what they want. bCloud searches it and can speak a short answer before the results open.",
    place: "embed",
    where: "Microphone button in suggestions and the AI search bar",
    api: "POST /shop/search/voice",
    link: "enableEmbed",
    toggle: "voice",
    countsSearches: true,
    fields: [
      { kind: "toggle", path: "voice.speakAnswer", label: "Speak the answer", help: "bCloud returns a short spoken answer that names only products it really found." },
      {
        kind: "note",
        text: "When a shopper taps the microphone, the search panel stays open with a live picture of their voice and the words heard, then the results page opens. The browser turns speech into text, so the button shows only in browsers that support it (Chrome, Edge, Safari). The preview shows the listening card; try speaking on your store.",
      },
    ],
  },
  {
    id: "image",
    label: "Picture search",
    summary: "Shoppers upload or take a photo. bCloud finds the same product and related ones.",
    place: "embed",
    where: "Camera button in suggestions and the AI search bar",
    api: "POST /shop/search/image",
    link: "enableEmbed",
    toggle: "image",
    countsSearches: true,
    fields: [
      { kind: "note", text: "Photos are made smaller in the shopper's browser before they are sent, and are not stored. You can try a photo in the preview." },
    ],
  },
  {
    id: "searchResults",
    label: "Search results page",
    summary: "bCloud's AI results with filters and paging, on your search page.",
    place: "block",
    where: "The app's AI search page (searches from your theme's search box open it)",
    api: "POST /shop/search",
    link: "addSearchResults",
    toggle: "searchResults",
    countsSearches: true,
    fields: [
      {
        kind: "layout",
        path: "searchResults.layout",
        label: "Product layout",
        options: [
          { value: "grid", label: "Grid", icon: "grid" },
          { value: "list", label: "List", icon: "list" },
        ],
      },
      {
        kind: "layout",
        path: "searchResults.filters",
        label: "Filters",
        options: [
          { value: "sidebar", label: "Sidebar", icon: "f-sidebar" },
          { value: "top", label: "Top bar", icon: "f-top" },
          { value: "drawer", label: "Drawer", icon: "f-drawer" },
          { value: "none", label: "None", icon: "f-none" },
        ],
      },
      { kind: "toggle", path: "searchResults.showOnSale", label: "“On sale only” filter", when: "searchResults.filters" },
      {
        kind: "select",
        path: "searchResults.pageSize",
        label: "Products per page",
        number: true,
        options: [12, 24, 36, 48].map((n) => ({ value: n, label: String(n) })),
      },
      { ...COLS, path: "searchResults.columns", label: "Columns on desktop" },
      { kind: "select", path: "searchResults.columnsMobile", label: "Columns on mobile", number: true, options: MOBILE },
      { kind: "text", path: "searchResults.heading", label: "Heading (optional)", max: 80, help: "The result count is always shown." },
      { kind: "note", text: "Sorting other than best match is not offered: bCloud does not document other sort values yet." },
    ],
  },
  {
    id: "trending",
    label: "Trending products",
    summary: "What shoppers view, click and buy most right now, for the whole shop or one category.",
    place: "block",
    where: "A Page Builder widget you place (home page or any page)",
    api: "GET /shop/trending",
    link: "addTrending",
    toggle: "trending",
    fields: [
      {
        kind: "layout",
        path: "trending.layout",
        label: "Layout",
        options: [
          { value: "carousel", label: "Slider", icon: "carousel" },
          { value: "grid", label: "Grid", icon: "grid" },
          { value: "list", label: "List", icon: "list" },
        ],
      },
      { kind: "text", path: "trending.eyebrow", label: "Small line above", max: 60, help: HELP_SHOP },
      { kind: "text", path: "trending.heading", label: "Heading", max: 80 },
      { kind: "category", path: "trending.category", label: "Products from" },
      { kind: "range", path: "trending.count", label: "Products", min: 2, max: 12 },
      { ...COLS, path: "trending.columns", label: "Columns on desktop" },
      { kind: "select", path: "trending.columnsMobile", label: "Columns on mobile", number: true, options: MOBILE },
      { kind: "toggle", path: "trending.showRank", label: "Show rank numbers" },
      { kind: "toggle", path: "trending.hideWhenEmpty", label: "Hide when there is nothing to show" },
      ...sliderFields("trending", "trending.layout=carousel"),
    ],
  },
  {
    id: "recommendations",
    label: "Recommendations",
    summary: "Recommended for you, deals, trending, pick up where you left off, recently viewed and recent searches, in one section.",
    place: "block",
    where: "A Page Builder widget you place (home page or any page)",
    api: "GET /shop/storefront",
    link: "addRail",
    toggle: "recommendations",
    fields: [
      {
        kind: "layout",
        path: "recommendations.layout",
        label: "Layout",
        options: [
          { value: "switcher", label: "Card with arrows", icon: "switcher" },
          { value: "tabs", label: "Tabs", icon: "tabs" },
          { value: "rows", label: "One row each", icon: "rows" },
          { value: "columns", label: "Side by side", icon: "rec-columns" },
        ],
      },
      {
        kind: "select",
        path: "recommendations.listsPerRow",
        label: "Lists in a row on a computer",
        number: true,
        options: [
          { value: 3, label: "3" },
          { value: 2, label: "2" },
        ],
        help: "Tablets show two, phones one under the other.",
        when: "recommendations.layout=columns",
      },
      {
        kind: "layout",
        path: "recommendations.display",
        label: "Products in each list",
        options: [
          { value: "grid", label: "Grid", icon: "grid" },
          { value: "carousel", label: "Slider", icon: "carousel" },
          { value: "list", label: "List", icon: "list" },
        ],
      },
      { kind: "text", path: "recommendations.eyebrow", label: "Small line above", max: 60, help: HELP_SHOP },
      { kind: "text", path: "recommendations.heading", label: "Heading", max: 80 },
      { kind: "rails" },
      { kind: "range", path: "recommendations.count", label: "Products per list", min: 2, max: 12 },
      { ...COLS, path: "recommendations.columns", label: "Columns on desktop" },
      { kind: "select", path: "recommendations.columnsMobile", label: "Columns on mobile", number: true, options: MOBILE },
      { kind: "toggle", path: "recommendations.hideWhenEmpty", label: "Hide when there is nothing to show" },
      ...sliderFields("recommendations", "recommendations.display=carousel"),
      {
        kind: "note",
        text: "Personal lists use the shopper's own browsing, so they need their privacy consent and some visits first. Recent searches are kept in the shopper's browser. Lists with nothing to show are skipped.",
      },
    ],
  },
  {
    id: "similar",
    label: "Similar products",
    summary: "Products like the one being viewed, on the product page.",
    place: "block",
    where: "A Page Builder widget on the product page",
    api: "GET /shop/ai-similar-products · /similar-products (category_id)",
    link: "addSimilar",
    toggle: "similar",
    fields: [
      {
        kind: "layout",
        path: "similar.layout",
        label: "Layout",
        options: [
          { value: "carousel", label: "Slider", icon: "carousel" },
          { value: "grid", label: "Grid", icon: "grid" },
        ],
      },
      {
        kind: "select",
        path: "similar.method",
        label: "How to find them",
        options: [
          { value: "category", label: "Like a shopper would: same category, closest AI match" },
          { value: "ai", label: "AI picks: closest meaning, any category" },
          { value: "text", label: "Title match: the same words in the title and description" },
        ],
        help: "All three are bCloud's own matching. Same category keeps a gift card away from a snowboard; when nothing is found there, the AI picks are shown.",
      },
      { kind: "text", path: "similar.heading", label: "Heading", max: 80 },
      { kind: "range", path: "similar.count", label: "Products", min: 2, max: 12 },
      { ...COLS, path: "similar.columns", label: "Columns on desktop" },
      { kind: "select", path: "similar.columnsMobile", label: "Columns on mobile", number: true, options: MOBILE },
      ...sliderFields("similar", "similar.layout=carousel"),
    ],
  },
  {
    id: "categories",
    label: "Popular categories",
    summary: "Your busiest categories, each opening AI search for that category.",
    place: "block",
    where: "A Page Builder widget you place (home page or any page)",
    api: "GET /shop/popularcat",
    link: "addCategories",
    toggle: "categories",
    fields: [
      {
        kind: "layout",
        path: "categories.layout",
        label: "Layout",
        options: [
          { value: "buttons", label: "Buttons", icon: "c-buttons" },
          { value: "tiles", label: "Picture tiles", icon: "c-tiles" },
          { value: "chips", label: "Chips", icon: "c-chips" },
        ],
      },
      { kind: "text", path: "categories.eyebrow", label: "Small line above", max: 60, help: HELP_SHOP },
      { kind: "text", path: "categories.heading", label: "Heading", max: 80 },
      { kind: "range", path: "categories.count", label: "Categories", min: 2, max: 24 },
      { ...COLS, path: "categories.columns", label: "Columns on desktop" },
      { kind: "select", path: "categories.columnsMobile", label: "Columns on mobile", number: true, options: MOBILE },
      { kind: "toggle", path: "categories.showCount", label: "Show how many products" },
    ],
  },
  {
    id: "chat",
    label: "AI assistant",
    summary: "A shopping chat that turns what shoppers say into a product search and shows the products.",
    place: "embed",
    where: "Every page, from a button or Ask AI",
    api: "POST /shop/search/ai-welcome · /search/ai-assistant",
    link: "enableEmbed",
    toggle: "chat",
    countsSearches: true,
    fields: [
      {
        kind: "layout",
        path: "chat.layout",
        label: "Layout",
        options: [
          { value: "sidebar", label: "Sidebar", icon: "chat-sidebar" },
          { value: "drawer", label: "Drawer", icon: "chat-drawer" },
          { value: "popup", label: "Chat window", icon: "chat-popup" },
        ],
      },
      {
        kind: "layout",
        path: "chat.position",
        label: "Side",
        options: [
          { value: "right", label: "Right", icon: "side-right" },
          { value: "left", label: "Left", icon: "side-left" },
        ],
      },
      {
        kind: "layout",
        path: "chat.launcher",
        label: "Button",
        options: [
          { value: "pill", label: "With text", icon: "btn-pill" },
          { value: "icon", label: "Icon only", icon: "btn-icon" },
          { value: "hidden", label: "No button", icon: "btn-none" },
        ],
      },
      { kind: "text", path: "chat.launcherText", label: "Button text", max: 24, help: "Also used for the Ask AI buttons." },
      { kind: "text", path: "chat.title", label: "Title", max: 60, help: HELP_SHOP },
      { kind: "text", path: "chat.subtitle", label: "Text under the title", max: 80 },
      { kind: "text", path: "chat.placeholder", label: "Message box text", max: 60 },
      { kind: "toggle", path: "chat.showWelcome", label: "Greeting and starter questions", help: "bCloud writes them for your catalogue when the chat opens." },
      { kind: "toggle", path: "chat.showSuggestions", label: "Suggested questions" },
      { kind: "text", path: "chat.suggestionsTitle", label: "Suggested questions title", max: 40, when: "chat.showSuggestions" },
      {
        kind: "layout",
        path: "chat.productLayout",
        label: "Products in answers",
        options: [
          { value: "grid", label: "Grid", icon: "grid" },
          { value: "carousel", label: "Slider", icon: "carousel" },
          { value: "list", label: "List", icon: "list" },
        ],
      },
      { kind: "range", path: "chat.productsPerAnswer", label: "Products per answer", min: 2, max: 6 },
      { kind: "toggle", path: "chat.voiceInput", label: "Microphone in the message box" },
      { kind: "note", text: "The assistant refines product searches only. It does not compare products or answer questions about store policies." },
    ],
  },
  {
    id: "style",
    label: "Look",
    summary: "Colours, corners and product cards shared by every section. Fonts come from your theme; a colour left empty uses your theme's.",
    place: "all",
    where: "Every bCloud section",
    api: "—",
    fields: [
      { kind: "palette" },
      {
        kind: "layout",
        path: "style.radius",
        label: "Corners",
        options: [
          { value: "soft", label: "Soft", icon: "r-soft" },
          { value: "sharp", label: "Sharp", icon: "r-sharp" },
          { value: "round", label: "Round", icon: "r-round" },
        ],
      },
      {
        kind: "select",
        path: "style.imageRatio",
        label: "Product picture shape",
        options: [
          { value: "square", label: "Square" },
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" },
          { value: "natural", label: "Original" },
        ],
      },
      { kind: "toggle", path: "style.showBrand", label: "Show the brand on product cards" },
      { kind: "toggle", path: "style.showSaleBadge", label: "“Sale” badge on reduced products" },
    ],
  },
];

/* ---------------- path helpers (settings are plain JSON) ---------------- */

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const current = (obj as Record<string, unknown>) ?? {};
  return {
    ...current,
    [head]: rest.length ? setPath(current[head] as Record<string, unknown>, rest.join("."), value) : value,
  } as T;
}

/**
 * A field shown only when its `when` condition holds:
 *   "path"          the setting is truthy and not "none"
 *   "path=a|b"      the setting is one of the values
 */
export function visible(settings: StorefrontSettings, when?: string): boolean {
  if (!when) return true;
  const [path, values] = when.split("=");
  const v = getPath(settings, path);
  if (values !== undefined) return values.split("|").includes(String(v));
  return !!v && v !== "none";
}
