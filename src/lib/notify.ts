/**
 * Tiny notification port. The UI registers a notifier (wired to Blueprint's
 * toast) via `setNotifier`; non-React code — e.g. data actions — calls `notify`
 * without needing React context. It no-ops until a notifier is registered, so
 * tests and headless callers stay silent.
 */
export interface NotifyItem {
  title: string;
  description?: string;
  /** Toast tone. Defaults to `success` — what every call site wanted. */
  variant?: "default" | "success" | "warning" | "destructive";
  /** How long the toast stays up, in ms. Falls back to the toaster default. */
  duration?: number;
  /** A single inline action button, e.g. "Undo". */
  action?: { label: string; onClick: () => void };
}

/**
 * What the UI plugs in. `show` hands back the toast id so callers that need to
 * retract their own notification early (the undo offer) can.
 */
export interface NotifyPort {
  show: (item: NotifyItem) => string;
  dismiss: (id: string) => void;
}

let port: NotifyPort | null = null;

export function setNotifier(next: NotifyPort | null): void {
  port = next;
}

/** Returns the toast id, or `""` when nothing is listening. */
export function notify(item: NotifyItem): string {
  return port?.show(item) ?? "";
}

export function dismissNotify(id: string): void {
  if (id) port?.dismiss(id);
}
