import { LogOut } from "lucide-react";
import { NavLink } from "../../lib/router";
import { NAV_SECTIONS } from "../../lib/navigation";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle, type Theme } from "./ThemeToggle";

interface SidebarProps {
  userName: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onSignOut: () => void;
}

export function Sidebar({ userName, theme, onThemeChange, onSignOut }: SidebarProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  return (
    <aside className="bc-sidebar" aria-label="Portal navigation">
      <NavLink to="/app" className="bc-brand" aria-label="bCloud AI client portal home">
        <BrandLogo />
        <span className="bc-brand-tag">CLIENT PORTAL</span>
      </NavLink>

      <nav className="bc-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="bc-nav-section">
            <p className="bc-nav-title">{section.title}</p>
            <ul className="bc-nav-list">
              {section.items.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/app"}
                    prefetch="intent"
                    className={({ isActive }) => `bc-nav-link${isActive ? " active" : ""}`}
                  >
                    <Icon aria-hidden strokeWidth={1.8} />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="bc-sidebar-foot">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <div className="bc-user">
          <span className="bc-avatar" aria-hidden>
            {initial}
          </span>
          <div>
            <p className="bc-user-name" title={userName}>
              {userName}
            </p>
            <button type="button" className="bc-signout" onClick={onSignOut}>
              Sign out <LogOut aria-hidden strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
