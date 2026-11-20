import { ShoppingBag } from "lucide-react";
import type { ProductArt } from "../../api/types";

interface ProductImageProps {
  title: string;
  imageUrl: string | null;
  art?: ProductArt;
}

/**
 * Real product photo when the API gives one. In static mode the mock data
 * has no photos, so simple generated artwork stands in for it.
 */
export function ProductImage({ title, imageUrl, art }: ProductImageProps) {
  if (imageUrl) {
    return (
      <div className="bc-product-img">
        <img src={imageUrl} alt={title} loading="lazy" />
      </div>
    );
  }
  if (!art) {
    return (
      <div className="bc-product-img is-empty" role="img" aria-label={`${title} (no image)`}>
        <ShoppingBag aria-hidden />
      </div>
    );
  }
  return (
    <div className="bc-product-img" role="img" aria-label={title}>
      <ArtWork art={art} />
    </div>
  );
}

export function ArtWork({ art }: { art: ProductArt }) {
  const [a, b] = art.colors;
  if (art.kind === "gift") {
    return (
      <span
        className="bc-art-gift"
        style={{
          background: `linear-gradient(90deg, transparent 44%, ${b} 44%, ${b} 56%, transparent 56%), linear-gradient(0deg, transparent 40%, ${b} 40%, ${b} 54%, transparent 54%), ${a}`,
        }}
      />
    );
  }
  if (art.kind === "wax" || art.kind === "bag") {
    return <span className="bc-art-wax" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }} />;
  }
  const accent = art.accent ?? b;
  return (
    <span className="bc-art-boards" aria-hidden>
      <span
        className="bc-art-board"
        style={{ background: `linear-gradient(180deg, ${a}, ${a} 60%, ${accent} 160%)` }}
      />
      <span
        className="bc-art-board"
        style={{
          background: `repeating-linear-gradient(135deg, ${b} 0 10px, ${accent} 10px 14px, ${b} 14px 22px)`,
        }}
      />
    </span>
  );
}
