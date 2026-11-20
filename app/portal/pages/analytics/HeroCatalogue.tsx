import type { ProductThumb } from "../../api/types";
import { ArtWork } from "../../components/ui/ProductImage";
import { formatInt } from "../../lib/format";

/**
 * Card slots around the magnifier: centre x and top as % of the stage, size
 * in px, and layer ("back" sits behind the glass, "front" in front of it).
 */
const SLOTS = [
  { x: 23.8, y: 34.7, w: 50, h: 60, layer: "back" },
  { x: 35.3, y: 31.8, w: 50, h: 57, layer: "back" },
  { x: 49.7, y: 27.9, w: 53, h: 60, layer: "back" },
  { x: 65.5, y: 32.4, w: 38, h: 64, layer: "back" },
  { x: 75.8, y: 34.7, w: 48, h: 57, layer: "back" },
  { x: 20.9, y: 35.3, w: 50, h: 70, layer: "front" },
  { x: 30.3, y: 42.6, w: 53, h: 75, layer: "front" },
  { x: 69.1, y: 44.7, w: 53, h: 63, layer: "front" },
  { x: 78.7, y: 38.2, w: 50, h: 60, layer: "front" },
  { x: 49.9, y: 44.7, w: 62, h: 76, layer: "lens" },
] as const;

export function HeroCatalogue({ count, preview }: { count: number; preview: ProductThumb[] }) {
  const items = preview.filter((p) => p.art || p.imageUrl);
  return (
    <section className="bc-card bc-hero" aria-label="Your catalogue in the AI index">
      <p className="bc-hero-label">Your catalogue, alive in the AI index</p>
      <div className="bc-hero-stage" aria-hidden>
        <div className="bc-hero-floor" />
        {items.length > 0 &&
          SLOTS.map((slot, i) => {
            const item = items[i % items.length];
            return (
              <div
                key={i}
                className={`bc-hero-card is-${slot.layer}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: slot.w,
                  height: slot.h,
                  animationDelay: `${(i % 5) * -0.9}s`,
                }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" />
                ) : item.art ? (
                  <ArtWork art={item.art} />
                ) : null}
              </div>
            );
          })}
        <div className="bc-hero-glow" />
        <div className="bc-hero-lens">
          <span className="bc-hero-glass" />
          <span className="bc-hero-handle" />
        </div>
      </div>
      <div className="bc-hero-count">
        <p className="bc-hero-number">{formatInt(count)}</p>
        <p className="bc-hero-caption">products indexed</p>
      </div>
    </section>
  );
}
