/** PLACEHOLDER illustration of "blu", the portal assistant robot. */
export function BluRobot({ size = 62 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="bc-blu-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7e3f7" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="14" ry="2" fill="#6d4aff" opacity="0.12" />
      {/* antenna */}
      <line x1="32" y1="7" x2="32" y2="13" stroke="#b9acf0" strokeWidth="1.6" />
      <circle cx="32" cy="6" r="2.4" fill="#8f76ff" />
      {/* ears */}
      <rect x="8" y="20" width="5" height="12" rx="2.5" fill="#6d4aff" />
      <rect x="51" y="20" width="5" height="12" rx="2.5" fill="#6d4aff" />
      {/* head */}
      <rect x="12" y="13" width="40" height="27" rx="9" fill="url(#bc-blu-body)" stroke="#dcd6f2" />
      <rect x="16" y="17" width="32" height="18" rx="6" fill="#2a2347" />
      <circle cx="25" cy="25" r="3.1" fill="#9c86ff" />
      <circle cx="39" cy="25" r="3.1" fill="#9c86ff" />
      <path d="M27 30c3 2.4 7 2.4 10 0" stroke="#9c86ff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="29" r="1.4" fill="#6b3a52" opacity="0.6" />
      <circle cx="44" cy="29" r="1.4" fill="#6b3a52" opacity="0.6" />
      {/* body */}
      <rect x="22" y="41" width="20" height="13" rx="6" fill="url(#bc-blu-body)" stroke="#dcd6f2" />
      <circle cx="32" cy="47" r="1.8" fill="#8f76ff" />
      {/* arms */}
      <path d="M22 45l-7 5" stroke="#6d4aff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M42 45l7 5" stroke="#6d4aff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="14" cy="51" r="2.4" fill="#6d4aff" />
      <circle cx="50" cy="51" r="2.4" fill="#6d4aff" />
      {/* feet */}
      <ellipse cx="27" cy="56" rx="3.4" ry="1.8" fill="#6d4aff" />
      <ellipse cx="37" cy="56" rx="3.4" ry="1.8" fill="#6d4aff" />
    </svg>
  );
}
