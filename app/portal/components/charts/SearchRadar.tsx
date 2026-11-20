import { useEffect, useMemo, useRef } from "react";
import { usePrefersReducedMotion } from "../../lib/hooks";
import { useChartPalette } from "../../lib/theme";

export interface RadarBlip {
  query: string;
  count: number;
  foundNothing: boolean;
}

const W = 760;
const H = 200;
const CX = 380;
const CY = 102;
const TILT = 0.235;
const RINGS = [118, 232, 348];
const SWEEP_DEG = 62;
const PERIOD_MS = 7000;

/** Rounded so server and browser produce identical SVG markup. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Stable pseudo-random angle per query so blips do not jump between loads. */
function angleFor(text: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 360) * (Math.PI / 180);
}

/** Decorative background blips (not data). */
const DUST = Array.from({ length: 12 }, (_, i) => ({
  ring: RINGS[i % 3] * (0.92 + ((i * 37) % 10) / 100),
  angle: angleFor(`dust${i}`, i),
  r: 1.6 + (i % 3) * 0.9,
}));

/**
 * "Live radar": a tilted radar with a rotating sweep. Each searched word is
 * a blip on a ring (most searched = inner ring); labels light up as the
 * sweep passes them.
 */
export function SearchRadar({ blips }: { blips: RadarBlip[] }) {
  const p = useChartPalette();
  const reduced = usePrefersReducedMotion();
  const sweepRef = useRef<SVGGElement>(null);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);

  const placed = useMemo(() => {
    const max = Math.max(1, ...blips.map((b) => b.count));
    return blips.slice(0, 14).map((b, i) => {
      const ring = RINGS[Math.min(2, Math.floor((i / Math.max(1, blips.length)) * 3))] * (0.9 + (i % 3) * 0.05);
      const angle = angleFor(b.query.toLowerCase());
      return {
        ...b,
        x: r2(CX + ring * Math.cos(angle)),
        y: r2(CY + ring * Math.sin(angle) * TILT),
        angle,
        r: r2(3.5 + (b.count / max) * 3.5),
      };
    });
  }, [blips]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const sweep = (((now - start) % PERIOD_MS) / PERIOD_MS) * 360;
      sweepRef.current?.setAttribute("transform", `rotate(${sweep})`);
      placed.forEach((b, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const deg = ((b.angle * 180) / Math.PI + 360) % 360;
        const behind = (sweep - deg + 360) % 360; // degrees since the sweep passed
        const glow = behind < 140 ? 1 - behind / 140 : 0;
        el.setAttribute("opacity", String(0.45 + glow * 0.55));
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [placed, reduced]);

  /** The sweep is drawn as thin slices that fade out behind the leading edge. */
  const sweepSlices = useMemo(() => {
    const r = RINGS[2];
    const steps = 24;
    const step = SWEEP_DEG / steps;
    return Array.from({ length: steps }, (_, i) => {
      const a0 = (-i * step * Math.PI) / 180;
      const a1 = (-(i + 1.15) * step * Math.PI) / 180;
      return {
        d: `M0 0 L${r2(r * Math.cos(a0))} ${r2(r * Math.sin(a0))} A${r} ${r} 0 0 0 ${r2(r * Math.cos(a1))} ${r2(r * Math.sin(a1))} Z`,
        opacity: 0.42 * Math.pow(1 - i / steps, 1.6),
      };
    });
  }, []);

  return (
    <svg className="bc-radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Live radar of searched words">
      <defs>
        <radialGradient id="bc-radar-core">
          <stop offset="0" stopColor={p.primary} stopOpacity="0.95" />
          <stop offset="1" stopColor={p.primary} stopOpacity="0" />
        </radialGradient>
      </defs>

      {RINGS.map((r) => (
        <ellipse key={r} cx={CX} cy={CY} rx={r} ry={r * TILT} fill="none" stroke={p.grid} strokeWidth="1.2" />
      ))}

      <g transform={`translate(${CX} ${CY}) scale(1 ${TILT})`}>
        <g ref={sweepRef} transform="rotate(180)">
          {sweepSlices.map((slice, i) => (
            <path key={i} d={slice.d} fill={p.primary} opacity={slice.opacity} />
          ))}
        </g>
      </g>

      {DUST.map((d, i) => (
        <circle
          key={i}
          cx={r2(CX + d.ring * Math.cos(d.angle))}
          cy={r2(CY + d.ring * Math.sin(d.angle) * TILT)}
          r={d.r}
          fill={p.light}
          opacity={0.55}
        />
      ))}

      <circle cx={CX} cy={CY} r="16" fill="url(#bc-radar-core)" />
      <circle cx={CX} cy={CY} r="4" fill={p.primary} />

      {placed.map((b, i) => (
        <g key={b.query}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.foundNothing ? p.red : p.primary} />
          <text
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            x={r2(b.x + b.r + 4)}
            y={r2(b.y + 3.5)}
            fontSize="10"
            fill={p.ink}
            opacity={0.8}
          >
            {b.query}
          </text>
        </g>
      ))}
    </svg>
  );
}
