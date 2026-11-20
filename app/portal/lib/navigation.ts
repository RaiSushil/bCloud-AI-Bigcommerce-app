import {
  BarChart3,
  Image as ImageIcon,
  LayoutTemplate,
  Magnet,
  Palette,
  Puzzle,
  Radio,
  RefreshCw,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar structure: bCloud's portal menu (Nov 2026), plus the app's own Storefront pages. */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Monitor",
    items: [
      { label: "Analytics", to: "/app", icon: BarChart3 },
      { label: "Live activity", to: "/app/live-activity", icon: Radio },
      { label: "Missed searches", to: "/app/missed-searches", icon: Magnet },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Products", to: "/app/products", icon: ImageIcon },
      { label: "Data sync", to: "/app/data-sync", icon: RefreshCw },
    ],
  },
  {
    title: "Money",
    items: [{ label: "Billing", to: "/app/billing", icon: Wallet }],
  },
  {
    title: "On your store",
    items: [
      { label: "Storefront", to: "/app/storefront", icon: LayoutTemplate },
      { label: "Storefront design", to: "/app/storefront-design", icon: Palette },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Install & keys", to: "/app/install-keys", icon: Puzzle },
      { label: "Settings", to: "/app/settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
