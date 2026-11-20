/** Shared with the Connect page (no server code here). */

export interface AccessRequestPrefill {
  ownerName: string;
  email: string;
  storeName: string;
  domain: string;
  phone: string;
}

/** The store's request as the Connect page shows it: no ids, no secrets. */
export interface AccessRequestView {
  status: "pending" | "approved" | "declined" | "connected";
  /** Masked, e.g. "pr•••@example.com". */
  emailHint: string | null;
  /** bCloud's short message for the merchant. */
  note: string | null;
  submittedAt: string;
  decidedAt: string | null;
}
