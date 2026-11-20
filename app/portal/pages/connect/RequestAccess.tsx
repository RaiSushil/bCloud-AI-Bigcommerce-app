import { CheckCircle2, Clock, MailQuestion, XCircle } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { useRevalidator } from "react-router";
import type { AccessRequestPrefill, AccessRequestView } from "../../api/services/access-request.types";
import { Modal } from "../../components/ui/Modal";
import { LocalDate } from "../../components/ui/Time";
import { useMutation } from "../../lib/useMutation";

export type { AccessRequestPrefill, AccessRequestView } from "../../api/services/access-request.types";

/** How often an open page asks the server again (the server asks bCloud at most once a minute). */
const POLL_MS = 60_000;

/**
 * "Don't have these? Request access": the store asks bCloud for a client ID, dashboard password
 * and product API key (server-side, access-request.server.ts). bCloud's admin answers; the
 * answer shows here (bCloud sends no email), and an approval connects the store by itself.
 */
export function RequestAccess({ prefill, request }: { prefill: AccessRequestPrefill | null; request: AccessRequestView | null }) {
  const [open, setOpen] = useState(false);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (request?.status !== "pending" || revalidator.state !== "idle") return;
    const id = window.setTimeout(() => revalidator.revalidate(), POLL_MS);
    return () => window.clearTimeout(id);
  }, [request?.status, revalidator]);

  // The form sits at the same place whatever the status, so it stays open (showing "Request
  // sent") when the page reloads with the new request.
  return (
    <>
      {request && request.status !== "connected" ? (
        <RequestStatus request={request} onNew={() => setOpen(true)} />
      ) : (
        <p className="bc-request-line">
          Don&apos;t have a client ID, dashboard password or product API key?{" "}
          <button type="button" className="bc-btn-link" onClick={() => setOpen(true)}>
            Request access from bCloud
          </button>
        </p>
      )}
      {open && prefill && <RequestForm prefill={prefill} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestStatus({ request, onNew }: { request: AccessRequestView; onNew: () => void }) {
  const check = useMutation();
  const Icon = request.status === "pending" ? Clock : request.status === "approved" ? CheckCircle2 : XCircle;
  return (
    <div className={`bc-request-status is-${request.status}`} role="status">
      <Icon aria-hidden className="bc-request-status-icon" />
      <div className="bc-request-status-body">
        {request.status === "pending" && (
          <p>
            <strong>Access requested</strong> on <LocalDate iso={request.submittedAt} />. bCloud is reviewing it. The answer shows
            here, and this page connects your store by itself once it is approved{request.emailHint ? <> (contact: {request.emailHint})</> : null}.
          </p>
        )}
        {request.status === "approved" && (
          <p>
            <strong>bCloud approved your request.</strong> {request.note ?? "Click Check now to connect your store."}
          </p>
        )}
        {request.status === "declined" && (
          <p>
            <strong>bCloud declined the request.</strong> {request.note}
          </p>
        )}
        <div className="bc-request-status-actions">
          {request.status !== "declined" ? (
            <check.fetcher.Form method="post">
              <input type="hidden" name="intent" value="check_access" />
              <button type="submit" className="bc-btn-link" disabled={check.busy}>
                {check.busy ? "Checking…" : "Check now"}
              </button>
            </check.fetcher.Form>
          ) : (
            // A new request replaces the declined one (the server allows it).
            <button type="button" className="bc-btn-link" onClick={onNew}>
              Send a new request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestForm({ prefill, onClose }: { prefill: AccessRequestPrefill; onClose: () => void }) {
  const [values, setValues] = useState(prefill);
  const [done, setDone] = useState(false);
  const { fetcher, busy, error } = useMutation(() => setDone(true));
  const set = (key: keyof AccessRequestPrefill) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const invalid = (name: string) => (error?.field === name ? true : undefined);
  const ready = values.ownerName.trim() && values.email.trim() && values.storeName.trim() && values.domain.trim();
  const close = () => onClose();

  return (
    <Modal title="Request bCloud access" onClose={close}>
      {done ? (
        <div className="bc-request-done" role="status">
          <CheckCircle2 aria-hidden className="bc-request-done-icon" />
          <p>
            <strong>Request sent.</strong> bCloud reviews it and the answer shows on this page. Once approved, the app connects
            your store by itself; just open this page again.
          </p>
          <div className="bc-form-actions">
            <button type="button" className="bc-btn is-sm" onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <fetcher.Form method="post" className="bc-connect-form" autoComplete="on">
          <input type="hidden" name="intent" value="request_access" />
          <p className="bc-connect-note">
            <MailQuestion aria-hidden className="bc-inline-icon" /> bCloud reviews your request. Once approved, the app receives
            the client ID, dashboard password and product API key and connects your store by itself. Your BigCommerce store address is added automatically.
          </p>
          <label className="bc-field">
            <span className="bc-field-label">Owner name</span>
            <input className="bc-input" name="owner_name" value={values.ownerName} onChange={set("ownerName")} autoComplete="name" maxLength={80} aria-invalid={invalid("owner_name")} required />
          </label>
          <label className="bc-field">
            <span className="bc-field-label">Email</span>
            <input className="bc-input" type="email" name="email" value={values.email} onChange={set("email")} autoComplete="email" maxLength={120} aria-invalid={invalid("email")} required />
          </label>
          <label className="bc-field">
            <span className="bc-field-label">Store name</span>
            <input className="bc-input" name="store_name" value={values.storeName} onChange={set("storeName")} autoComplete="organization" maxLength={80} aria-invalid={invalid("store_name")} required />
          </label>
          <label className="bc-field">
            <span className="bc-field-label">Store domain</span>
            <input className="bc-input" name="domain" value={values.domain} onChange={set("domain")} placeholder="mystore.com" autoComplete="url" spellCheck={false} maxLength={300} aria-invalid={invalid("domain")} required />
          </label>
          <label className="bc-field">
            <span className="bc-field-label">
              Contact number <span className="bc-field-optional">(optional)</span>
            </span>
            <input className="bc-input" type="tel" name="phone" value={values.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} aria-invalid={invalid("phone")} />
          </label>
          {error && <p className="bc-form-msg is-error">{error.error}</p>}
          <div className="bc-form-actions">
            <button type="button" className="bc-btn-soft is-sm is-plain" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="bc-btn is-sm" disabled={busy || !ready}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </fetcher.Form>
      )}
    </Modal>
  );
}
