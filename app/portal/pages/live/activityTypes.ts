import { CircleCheck, Eye, Globe, Heart, MousePointerClick, Radio, ShoppingCart, type LucideIcon } from "lucide-react";
import type { ActivityFilter, ActivityType } from "../../api/types";
import type { ChartPalette } from "../../lib/theme";

export const FILTERS: { value: ActivityFilter; label: string; icon: LucideIcon }[] = [
  { value: "everything", label: "Everything", icon: Globe },
  { value: "clicks", label: "Clicks", icon: MousePointerClick },
  { value: "carts", label: "Carts", icon: ShoppingCart },
  { value: "wishlist", label: "Wishlist", icon: Heart },
  { value: "purchases", label: "Purchases", icon: CircleCheck },
  { value: "views", label: "Views", icon: Eye },
  { value: "impressions", label: "Impressions", icon: Radio },
];

export const TYPE_META: Record<ActivityType, { label: string; verb: string; icon: LucideIcon; color: keyof ChartPalette }> = {
  click: { label: "Clicks", verb: "opened", icon: MousePointerClick, color: "primary" },
  add_to_cart: { label: "Carts", verb: "added to cart", icon: ShoppingCart, color: "orange" },
  wishlist: { label: "Wishlist", verb: "saved", icon: Heart, color: "red" },
  purchase: { label: "Purchases", verb: "bought", icon: CircleCheck, color: "teal" },
  view: { label: "Views", verb: "viewed", icon: Eye, color: "light" },
  impression: { label: "Impressions", verb: "saw", icon: Radio, color: "gray" },
};
