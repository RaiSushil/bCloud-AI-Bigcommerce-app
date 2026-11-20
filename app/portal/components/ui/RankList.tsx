interface RankRow {
  label: string;
  meta: string;
  /** 0-1: width of the background bar. Omit for no bar. */
  share?: number;
}

export function RankList({ rows, barred = false }: { rows: RankRow[]; barred?: boolean }) {
  return (
    <ol className={`bc-rank${barred ? " is-barred" : ""}`}>
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="bc-rank-row">
          {barred && row.share !== undefined && (
            <span className="bc-rank-bar" style={{ width: `${Math.max(0, Math.min(1, row.share)) * 100}%` }} aria-hidden />
          )}
          <span>
            <span className="bc-rank-num">{i + 1}.</span>
            {row.label}
          </span>
          <span className="bc-rank-meta">{row.meta}</span>
        </li>
      ))}
    </ol>
  );
}
