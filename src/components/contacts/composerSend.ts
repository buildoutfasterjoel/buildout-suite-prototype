/**
 * The two ways an assistant-drafted email can actually go out.
 *
 * 1. The live composer's own send, published here by the mounted
 *    `ContactComposeModule`. Preferred whenever it's open: `send_email` could
 *    have re-implemented sending against the store, but then "send it" and the
 *    Send Email button would be two code paths that drift — and the assistant
 *    would send the last version *it* wrote rather than what the broker is
 *    looking at, hand edits included.
 *
 * 2. The last draft the assistant wrote, held here as a fallback. Requiring the
 *    composer meant "send it" failed whenever the broker hadn't opened the draft
 *    yet — which is most of the time, since the draft card deliberately doesn't
 *    navigate anywhere. The draft is a complete email and the recipient is a
 *    real record, so there's nothing to open first.
 *
 * Module-level slots rather than a store: only one composer is ever mounted, one
 * draft is ever pending, and nothing renders off either. Mirrors
 * `registerStopForCall` in `callFlow.ts`.
 */

/** What the composer reports back, so the assistant can confirm specifically. */
export type ComposerSendResult =
  | {
      sent: true;
      subject: string;
      to: string;
      contactId: string;
      contactName: string;
      /**
       * The body as actually sent, hand edits included. The rail's sent-email
       * receipt folds it behind "Show Content" — which still means holding it.
       */
      body: string;
    }
  /** Nothing to send — no composer mounted, wrong tab, or an empty draft. */
  | { sent: false; reason: string };

/** The assistant's most recent draft, sendable without opening anything. */
export interface PendingEmail {
  contactId: string;
  contactName: string;
  to: string;
  subject: string;
  body: string;
}

let handler: (() => ComposerSendResult) | null = null;
let pending: PendingEmail | null = null;

/** Called by the composer on mount; pass `null` on unmount. */
export function registerComposerSend(fn: (() => ComposerSendResult) | null): void {
  handler = fn;
}

/** Ask the mounted composer to send. `null` when there isn't one to ask. */
export function requestComposerSend(): ComposerSendResult | null {
  return handler ? handler() : null;
}

/** Remember (or clear) the assistant's latest draft as the fallback send target. */
export function setPendingEmail(email: PendingEmail | null): void {
  pending = email;
}

export function getPendingEmail(): PendingEmail | null {
  return pending;
}
