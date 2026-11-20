import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { themeStore } from "../../lib/themeStore";
import { BluAssistant } from "./BluAssistant";
import { Sidebar } from "./Sidebar";
import { ThemeContext, type Theme } from "../../lib/theme";
import { ToastProvider, useToast } from "./ToastProvider";

interface PortalShellProps {
  userName: string;
  children: ReactNode;
}

/**
 * Sidebar + page area + footer + blu. Wraps every portal page.
 * BigCommerce has no app menu of its own, so the portal shows its sidebar (the same one as
 * portal.bcloudai.com).
 */
export function PortalShell({ userName, children }: PortalShellProps) {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);
  const changeTheme = useCallback((next: Theme) => themeStore.set(next), []);

  return (
    <div className="bc-portal" data-theme={theme}>
      <ThemeContext.Provider value={theme}>
        <ToastProvider>
          <ShellLayout userName={userName} theme={theme} onThemeChange={changeTheme}>
            {children}
          </ShellLayout>
        </ToastProvider>
      </ThemeContext.Provider>
    </div>
  );
}

function ShellLayout({
  userName,
  theme,
  onThemeChange,
  children,
}: {
  userName: string;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  children: ReactNode;
}) {
  const toast = useToast();
  // The app is signed in through the BigCommerce control panel, so there is no
  // separate portal session to end here.
  const onSignOut = useCallback(
    () => toast("You are signed in through BigCommerce. Close the app from your BigCommerce control panel."),
    [toast],
  );

  return (
    <div className="bc-layout">
      <Sidebar userName={userName} theme={theme} onThemeChange={onThemeChange} onSignOut={onSignOut} />
      <main className="bc-main">
        <div className="bc-page">{children}</div>
        <footer className="bc-footer">bCloud AI · Client Portal · your data only, always</footer>
      </main>
      <BluAssistant />
    </div>
  );
}
