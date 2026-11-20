import { Bot, Camera, Globe, Keyboard, Mic, type LucideIcon } from "lucide-react";
import type { SearchDoor } from "../../api/types";
import type { Tone } from "../../components/ui/StatCard";

/** The four ways a shopper can search ("doors"), plus "all" (the page default, no card of its own). */
export const DOORS: { value: SearchDoor; label: string; card: string; icon: LucideIcon; tone: Tone }[] = [
  { value: "all", label: "All searches", card: "All 4 together", icon: Globe, tone: "primary" },
  { value: "box", label: "Search box", card: "Search box", icon: Keyboard, tone: "strong" },
  { value: "assistant", label: "AI Assistant", card: "AI Assistant", icon: Bot, tone: "amber" },
  { value: "voice", label: "Voice search", card: "Voice search", icon: Mic, tone: "red" },
  { value: "image", label: "Image search", card: "Image search", icon: Camera, tone: "teal" },
];

export const DOOR_BY_VALUE = Object.fromEntries(DOORS.map((d) => [d.value, d])) as Record<
  SearchDoor,
  (typeof DOORS)[number]
>;
