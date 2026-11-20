import type { BcTicket } from "../bcloud.types";
import { usesApi } from "../config.server";
import { apiRequest, type PortalContext } from "../http.server";
import { mockState, newId } from "../mock/store.server";
import type { MutationResult, SupportData, Ticket, TicketPriority } from "../types";

export const TICKET_PRIORITIES: TicketPriority[] = ["low", "normal", "high"];
const SUBJECT_MIN = 3; // Client Dashboard API: subject 3-200 characters
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 4000;

export function mapTicket(t: BcTicket): Ticket {
  return {
    id: t.id,
    subject: t.subject,
    priority: TICKET_PRIORITIES.includes(t.priority) ? t.priority : "normal",
    status: t.status === "pending" || t.status === "resolved" ? t.status : "open",
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    messages: (t.messages ?? []).map((m, i) => ({
      id: `${t.id}-${i}`,
      from: m.who === "client" ? "you" : "team",
      body: m.text,
      at: m.at,
    })),
  };
}

export async function getSupport(ctx: PortalContext): Promise<SupportData> {
  if (!usesApi("support")) {
    return { tickets: [...mockState().tickets], updatedAt: new Date().toISOString() };
  }
  const raw = await apiRequest<{ tickets: BcTicket[] }>(ctx, "ticketsList");
  const tickets = (raw.tickets ?? []).map(mapTicket).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { tickets, updatedAt: new Date().toISOString() };
}

export async function createTicket(
  ctx: PortalContext,
  input: { subject: string; message: string; priority: string },
): Promise<MutationResult> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  const priority = TICKET_PRIORITIES.includes(input.priority as TicketPriority) ? (input.priority as TicketPriority) : "normal";
  if (subject.length < SUBJECT_MIN) return { ok: false, error: "Add a short subject (3 characters or more).", field: "subject" };
  if (subject.length > SUBJECT_MAX) return { ok: false, error: "The subject is too long.", field: "subject" };
  if (!message) return { ok: false, error: "Tell us what happened.", field: "message" };
  if (message.length > MESSAGE_MAX) return { ok: false, error: "The message is too long.", field: "message" };

  if (!usesApi("support")) {
    const now = new Date().toISOString();
    mockState().tickets.unshift({
      id: newId("t"),
      subject,
      priority,
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [{ id: newId("m"), from: "you", body: message, at: now }],
    });
  } else {
    await apiRequest(ctx, "ticketsCreate", { body: { subject, message, priority } });
  }
  return { ok: true, message: "Ticket sent. The team will answer here." };
}

export type TicketAction = "reply" | "resolve";

export async function updateTicket(
  ctx: PortalContext,
  input: { ticketId: string; action: TicketAction; message?: string },
): Promise<MutationResult> {
  const message = (input.message ?? "").trim();
  if (!input.ticketId) return { ok: false, error: "Missing ticket." };
  if (input.action === "reply" && !message) return { ok: false, error: "Write a reply first.", field: "message" };
  if (message.length > MESSAGE_MAX) return { ok: false, error: "The message is too long.", field: "message" };

  if (!usesApi("support")) {
    const ticket = mockState().tickets.find((t) => t.id === input.ticketId);
    if (!ticket) return { ok: false, error: "Ticket not found." };
    const now = new Date().toISOString();
    if (input.action === "reply") ticket.messages.push({ id: newId("m"), from: "you", body: message, at: now });
    ticket.status = input.action === "resolve" ? "resolved" : "open";
    ticket.updatedAt = now;
    return { ok: true };
  }

  await apiRequest(ctx, "ticketsReply", {
    body:
      input.action === "resolve"
        ? { ticket_id: input.ticketId, resolve: true }
        : { ticket_id: input.ticketId, message },
  });
  return { ok: true, message: input.action === "resolve" ? "Ticket resolved." : undefined };
}
