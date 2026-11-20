import { CheckCircle2, KeyRound, ListChecks, Plug, Unplug } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "../../lib/router";
import { PageHeader } from "../../components/shell/PageHeader";
import { Card } from "../../components/ui/Card";
import { LocalDate } from "../../components/ui/Time";
import { useMutation } from "../../lib/useMutation";
import { RequestAccess, type AccessRequestPrefill, type AccessRequestView } from "./RequestAccess";

interface ConnectionView {
  clientId: string;
  connectedAt: string;
  hasKey: boolean;
  keyLast4: string | null;
}

interface ConnectPageProps {
  connection: ConnectionView | null;
  staticMode: boolean;
  /** "Request access" form: the store's own BigCommerce details, and whether the server can send. */
  accessRequest: { enabled: boolean; prefill: AccessRequestPrefill | null; request: AccessRequestView | null };
}

export function ConnectPage({ connection, staticMode, accessRequest }: ConnectPageProps) {
  const [editing, setEditing] = useState(!connection);
  // A connection made while the page is open (an approved access request) shows the
  // Connected card at once.
  const connectedAt = connection?.connectedAt ?? null;
  const [seenConnectedAt, setSeenConnectedAt] = useState(connectedAt);
  if (connectedAt !== seenConnectedAt) {
    setSeenConnectedAt(connectedAt);
    if (connectedAt) setEditing(false);
  }
  return (
    <>
      <PageHeader
        icon={Plug}
        title="Connect bCloud"
        subtitle="Link this store to its bCloud AI Search account once. The app signs in for you and keeps search in step with your products; the password and key are stored encrypted on our server and never shown in the browser."
      />
      <div className="bc-content bc-connect">
        {staticMode && (
          <p className="bc-connect-note">
            The app is in static mode, so pages show demo data and do not need a connection. Connecting still saves the
            login for when the API is switched on.
          </p>
        )}
        {connection && !editing ? (
          <Connected
            connection={connection}
            onChange={() => setEditing(true)}
            approvedAt={accessRequest.request?.status === "connected" ? (accessRequest.request.decidedAt ?? accessRequest.request.submittedAt) : null}
          />
        ) : (
          <div className="bc-connect-layout">
            <ConnectForm existing={connection} onCancel={() => setEditing(false)} accessRequest={accessRequest} />
            <WhatHappens />
          </div>
        )}
      </div>
    </>
  );
}

function Connected({
  connection,
  onChange,
  approvedAt,
}: {
  connection: ConnectionView;
  onChange: () => void;
  /** Set when the store was connected from an approved access request. */
  approvedAt: string | null;
}) {
  const navigate = useNavigate();
  const { fetcher, busy } = useMutation(() => navigate("/app/connect", { replace: true }));
  return (
    <Card title="Connected" icon={CheckCircle2}>
      <dl className="bc-kv">
        <div>
          <dt>bCloud client ID</dt>
          <dd className="bc-mono-accent">{connection.clientId}</dd>
        </div>
        <div>
          <dt>Connected since</dt>
          <dd>
            <LocalDate iso={connection.connectedAt} />
          </dd>
        </div>
        <div>
          <dt>Product API key</dt>
          <dd>
            {connection.hasKey ? (
              <span className="bc-mono-accent">•••• {connection.keyLast4}</span>
            ) : (
              <>
                Not saved yet. <Link to="/app/data-sync">Add it on Data sync</Link> so product changes reach search.
              </>
            )}
          </dd>
        </div>
        {approvedAt && (
          <div>
            <dt>Access</dt>
            <dd>
              Approved by bCloud on <LocalDate iso={approvedAt} />; the app connected by itself
            </dd>
          </div>
        )}
        <div>
          <dt>Product updates</dt>
          <dd>{connection.hasKey ? "Automatic: BigCommerce changes reach search within seconds" : "Off until the API key is saved"}</dd>
        </div>
      </dl>
      <div className="bc-connect-actions">
        <button type="button" className="bc-btn-soft is-sm is-plain" onClick={onChange}>
          Use a different account
        </button>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="disconnect" />
          <button type="submit" className="bc-btn-soft is-sm is-plain" disabled={busy}>
            <Unplug aria-hidden /> Disconnect
          </button>
        </fetcher.Form>
      </div>
    </Card>
  );
}

function ConnectForm({
  existing,
  onCancel,
  accessRequest,
}: {
  existing: ConnectionView | null;
  onCancel: () => void;
  accessRequest: ConnectPageProps["accessRequest"];
}) {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const { fetcher, busy, error } = useMutation(() => navigate("/app"));
  // Reconnecting the same account may keep the key already saved.
  const keyOptional = !!existing?.hasKey && clientId.trim() === existing.clientId;
  const ready = !!clientId.trim() && !!password && (keyOptional || apiKey.trim().length >= 20);

  return (
    <Card title="Sign in to bCloud" icon={Plug}>
      <fetcher.Form method="post" className="bc-connect-form" autoComplete="off">
        <input type="hidden" name="intent" value="connect" />
        <label className="bc-field">
          <span className="bc-field-label">Client ID</span>
          <input
            className="bc-input"
            name="client_id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. luna-jewels"
            autoComplete="username"
            maxLength={100}
            aria-invalid={error?.field === "client_id" || undefined}
            aria-describedby="bc-connect-help"
            required
          />
        </label>
        <label className="bc-field">
          <span className="bc-field-label">Dashboard password</span>
          <input
            className="bc-input"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="The password for portal.bcloudai.com"
            autoComplete="current-password"
            maxLength={200}
            aria-invalid={error?.field === "password" || undefined}
            required
          />
        </label>
        <label className="bc-field">
          <span className="bc-field-label">
            <KeyRound aria-hidden className="bc-inline-icon" /> Product API key
          </span>
          <input
            className="bc-input is-mono"
            type="password"
            name="api_key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyOptional ? `Leave empty to keep the saved key (•••• ${existing?.keyLast4 ?? ""})` : "The secret key for sending products (X-API-Key)"}
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
            aria-invalid={error?.field === "api_key" || undefined}
            required={!keyOptional}
          />
        </label>
        {error && <p className="bc-form-msg is-error">{error.error}</p>}
        <p className="bc-connect-note" id="bc-connect-help">
          All three are in the welcome document bCloud sent you. The product API key is not the site token, and it is shown
          only once: if it is lost, ask bCloud for a new one.
        </p>
        <div className="bc-form-actions">
          {existing && (
            <button type="button" className="bc-btn-soft is-sm is-plain" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="bc-btn is-sm" disabled={busy || !ready}>
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      </fetcher.Form>
      {accessRequest.enabled && <RequestAccess prefill={accessRequest.prefill} request={accessRequest.request} />}
    </Card>
  );
}

/** Sets expectations before the merchant presses Connect: nothing here needs a Sync button. */
function WhatHappens() {
  return (
    <Card title="When you connect" icon={ListChecks}>
      <ol className="bc-connect-steps">
        <li>
          <strong>Your login is checked</strong> with bCloud, and the key is checked to belong to the same account.
        </li>
        <li>
          <strong>Your storefront is prepared.</strong> Search, suggestions, AI assistant, voice, photo search and the
          product lists use this account&apos;s public site token. Turn them on from the Storefront page.
        </li>
        <li>
          <strong>Your products are sent once.</strong> Visible products reach search within a few minutes; hidden and
          disabled products stay out.
        </li>
        <li>
          <strong>Search stays current by itself.</strong> New, edited and deleted products and stock changes reach search
          within seconds. No Sync button needed.
        </li>
      </ol>
    </Card>
  );
}
