/**
 * PLACEHOLDER artwork that approximates the bCloud AI logo.
 * Replace with the official asset (e.g. <img src="/brand/bcloud-logo.svg" />)
 * when the brand team provides it. Size and position are already correct.
 */
export function BrandLogo() {
  return (
    <svg
      width="80"
      height="46"
      viewBox="0 0 80 46"
      role="img"
      aria-label="bCloud AI"
      className="bc-brand-logo"
    >
      <defs>
        <linearGradient id="bc-logo-cloud" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f7bff" />
          <stop offset="1" stopColor="#4f35e6" />
        </linearGradient>
      </defs>
      {/* dark swoosh behind the cloud */}
      <path d="M44 25c6-1 12-6 14-13 4 6 2 14-6 16-3 1-6 0-8-3z" fill="#16141f" />
      {/* cloud */}
      <path
        d="M22 26c-5 0-7-6-2-8 0-6 7-9 12-5 3-7 14-7 17 1 5 0 7 6 3 9-2 2-4 3-7 3H22z"
        fill="url(#bc-logo-cloud)"
      />
      {/* circuit lines */}
      <g stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round">
        <path d="M17 13h12" />
        <path d="M14 18h20" />
        <path d="M18 23h12" />
      </g>
      <g fill="#fff">
        <circle cx="30" cy="13" r="1.6" />
        <circle cx="35" cy="18" r="1.6" />
        <circle cx="31" cy="23" r="1.6" />
      </g>
      {/* growth arrow */}
      <path d="M46 22c4-3 7-8 9-14" stroke="#4f35e6" strokeWidth="1.8" fill="none" />
      <path d="M52 6l6-3 0 7z" fill="#ff7a2f" />
      <rect x="59" y="12" width="3" height="3" rx="0.5" fill="#7a63ff" />
      <rect x="62" y="9" width="1.8" height="1.8" fill="#16141f" />
      <text
        x="40"
        y="43"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="17"
        fontWeight="800"
        letterSpacing="-0.3"
        fill="currentColor"
      >
        <tspan fill="#5b3bd6">b</tspan>Cloud AI
      </text>
    </svg>
  );
}
