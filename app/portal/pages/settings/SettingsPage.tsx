import { Ban, Building2, ExternalLink, Eye, KeyRound, Lock, Package, Plug, Settings, ShieldCheck, ShoppingBag, Timer } from "lucide-react";
import { useState } from "react";
import { Link } from "../../lib/router";
import type { AccountSummary, OverviewData, SupportData, SynonymsData } from "../../api/types";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { Pill } from "../../components/ui/Pill";
import { LocalDate } from "../../components/ui/Time";
import { formatInt, maskToken, timeAgo } from "../../lib/format";
import { useMutation } from "../../lib/useMutation";
import { IntegrationDoctor } from "./IntegrationDoctor";
import { SupportSection } from "./SupportSection";
import { SynonymsSection } from "./SynonymsSection";

interface SettingsPageProps {
  account: AccountSummary;
  doctor: OverviewData["integration"];
  synonyms: SynonymsData;
  support: SupportData;
  selectedTicket: string | null;
  passwordMinLength: number;
  now: number;
}

/**
 * Settings, as in bCloud's portal (Nov 2026): account and password, the Integration doctor,
 * Search settings (synonyms) and Support (tickets) as sections of one page.
 */
export function SettingsPage({ account, doctor, synonyms, support, selectedTicket, passwordMinLength, now }: SettingsPageProps) {
  return (
    <>
      <PageHeader icon={Settings} title="Settings" subtitle="Your account, search words, support and password." />

      <div className="bc-content">
        <div className="bc-grid bc-cols-2">
          <Card
            title="Account"
            icon={Building2}
            action={
              <Link to="/app/connect" className="bc-card-link">
                <Plug aria-hidden /> Connection
              </Link>
            }
          >
            <dl className="bc-kv">
              <div>
                <dt>Company</dt>
                <dd>
                  <strong>{account.companyName}</strong>
                </dd>
              </div>
              <div>
                <dt>Client ID</dt>
                <dd className="bc-mono-accent">{account.clientId}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>
                  <Pill dot>{account.status === "active" ? "Active" : "Paused"}</Pill>
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{account.memberSince ? <LocalDate iso={account.memberSince} /> : "—"}</dd>
              </div>
              <div>
                <dt>Products live</dt>
                <dd>{formatInt(account.productsLive)}</dd>
              </div>
              <div>
                <dt>Last search on your site</dt>
                <dd>{timeAgo(account.lastSearchAt, now)}</dd>
              </div>
              <div>
                <dt>Last product sync</dt>
                <dd>{timeAgo(account.lastProductSyncAt, now)}</dd>
              </div>
              <div>
                <dt>Site token</dt>
                <dd className="bc-kv-token">
                  <span className="bc-mono-accent">{maskToken(account.siteToken)}</span>
                  <CopyButton value={account.siteToken} className="bc-btn-soft is-sm is-plain" what="Site token" />
                </dd>
              </div>
              <div>
                <dt>Portal address</dt>
                <dd>
                  <a href={account.portalUrl} target="_blank" rel="noreferrer" className="bc-card-link">
                    {account.portalUrl.replace(/^https?:\/\//, "")} <ExternalLink aria-hidden />
                  </a>
                </dd>
              </div>
            </dl>
          </Card>

          <ChangePassword minLength={passwordMinLength} />
        </div>

        <div className="bc-grid bc-cols-3">
          <IntegrationDoctor {...doctor} now={now} />
          <Card title="Your products" icon={Package} className="bc-products-tile">
            <div className="bc-products-big">
              <span className="bc-products-icon" aria-hidden>
                <ShoppingBag />
              </span>
              <div>
                <p className="bc-products-count">{formatInt(account.productsLive)}</p>
                <p className="bc-products-caption">products live in your AI search</p>
              </div>
            </div>
          </Card>

          <Card title="Your session, protected" icon={ShieldCheck}>
            <ul className="bc-protect">
              <li>
                <Timer aria-hidden /> Sign-ins last 8 hours, then a fresh login is needed
              </li>
              <li>
                <Lock aria-hidden /> Password stored only as a strong hash — nobody can read it
              </li>
              <li>
                <Ban aria-hidden /> Wrong password 8 times → login pauses for 10 minutes
              </li>
              <li>
                <Eye aria-hidden /> You can only ever see YOUR data — enforced on every request
              </li>
            </ul>
          </Card>
        </div>

        <SynonymsSection data={synonyms} />

        <SupportSection data={support} selectedId={selectedTicket} now={now} />
      </div>
    </>
  );
}

function ChangePassword({ minLength }: { minLength: number }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const { fetcher, busy, error } = useMutation(() => setForm({ current: "", next: "", confirm: "" }));
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Card title="Change portal password" icon={KeyRound}>
      <fetcher.Form method="post" className="bc-password" autoComplete="off">
        <input type="hidden" name="intent" value="change-password" />
        <label className="bc-field">
          <span className="bc-field-label">Current password</span>
          <input
            className="bc-input"
            type="password"
            name="current"
            autoComplete="current-password"
            placeholder="Current password"
            value={form.current}
            onChange={set("current")}
            aria-invalid={error?.field === "current" || undefined}
            required
          />
        </label>
        <label className="bc-field">
          <span className="bc-field-label">New password</span>
          <input
            className="bc-input"
            type="password"
            name="next"
            autoComplete="new-password"
            placeholder={`${minLength} characters or more`}
            minLength={minLength}
            value={form.next}
            onChange={set("next")}
            aria-invalid={error?.field === "next" || undefined}
            required
          />
        </label>
        <label className="bc-field">
          <span className="bc-field-label">New password again</span>
          <input
            className="bc-input"
            type="password"
            name="confirm"
            autoComplete="new-password"
            placeholder="Type it once more"
            value={form.confirm}
            onChange={set("confirm")}
            aria-invalid={error?.field === "confirm" || undefined}
            required
          />
        </label>
        {error && <p className="bc-form-msg is-error">{error.error}</p>}
        <button type="submit" className="bc-btn is-block bc-password-btn" disabled={busy}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </fetcher.Form>
    </Card>
  );
}
