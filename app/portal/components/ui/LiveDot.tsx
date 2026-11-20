export function LiveDot({ on = false, label }: { on?: boolean; label?: string }) {
  return <span className={`bc-live-dot${on ? " is-on" : ""}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
