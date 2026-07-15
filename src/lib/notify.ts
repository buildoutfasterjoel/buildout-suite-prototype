/**
 * Tiny notification port. The UI registers a notifier (wired to Blueprint's
 * toast) via `setNotifier`; non-React code — e.g. data actions — calls `notify`
 * without needing React context. It no-ops until a notifier is registered, so
 * tests and headless callers stay silent.
 */
export interface NotifyItem {
  title: string;
  description?: string;
}

type Notifier = (item: NotifyItem) => void;

let notifier: Notifier | null = null;

export function setNotifier(fn: Notifier | null): void {
  notifier = fn;
}

export function notify(item: NotifyItem): void {
  notifier?.(item);
}
