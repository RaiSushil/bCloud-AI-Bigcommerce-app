import { ArrowRight, Stethoscope } from "lucide-react";
import { Link } from "../../lib/router";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { timeAgo } from "../../lib/format";

interface IntegrationDoctorProps {
  talking: boolean;
  lastSearchAt: string | null;
  lastProductSyncAt: string | null;
  planLabel: string | null;
  now: number;
}

export function IntegrationDoctor({ talking, lastSearchAt, lastProductSyncAt, planLabel, now }: IntegrationDoctorProps) {
  return (
    <Card title="Integration doctor" icon={Stethoscope} className="bc-doctor">
      <p className="bc-doctor-status">
        <span className={`bc-doctor-dot${talking ? "" : " is-off"}`} aria-hidden />
        {talking ? "Your site is talking to us" : "We have not heard from your site yet"}
      </p>
      <dl className="bc-doctor-list">
        <div>
          <dt>Last search:</dt>
          <dd>{timeAgo(lastSearchAt, now)}</dd>
        </div>
        <div>
          <dt>Last product sync:</dt>
          <dd>{timeAgo(lastProductSyncAt, now)}</dd>
        </div>
        <div>
          <dt>Plan:</dt>
          <dd>{planLabel ? <Pill tone="amber">{planLabel}</Pill> : "—"}</dd>
        </div>
      </dl>
      <Link to="/app/install-keys" className="bc-card-link">
        Install &amp; keys <ArrowRight aria-hidden />
      </Link>
    </Card>
  );
}
