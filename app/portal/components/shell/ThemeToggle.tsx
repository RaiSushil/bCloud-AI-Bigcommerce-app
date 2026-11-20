import { Moon, Sun } from "lucide-react";

import type { Theme } from "../../lib/theme";

export type { Theme };

interface ThemeToggleProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="bc-theme-toggle"
      role="switch"
      aria-checked={dark}
      onClick={() => onChange(dark ? "light" : "dark")}
    >
      {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
      <span>{dark ? "Dark mode" : "Light mode"}</span>
      <span className="bc-switch" data-on={dark} aria-hidden />
    </button>
  );
}
