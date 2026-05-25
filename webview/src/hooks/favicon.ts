export const FAVICON_DEFAULT = '/favicon.svg';
export const FAVICON_UNREAD = '/favicon-unread.svg';

function setFavicon(href: string): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (link && link.href !== href) {
    link.href = href;
  }
}

/**
 * Swap the favicon to the unread variant. Idempotent — safe to call
 * repeatedly while the user is away.
 */
export function setUnreadFavicon(): void {
  setFavicon(FAVICON_UNREAD);
}

/**
 * Restore the default favicon. Idempotent.
 */
export function restoreDefaultFavicon(): void {
  setFavicon(FAVICON_DEFAULT);
}

/**
 * Whether the current favicon is the unread variant. Reads from the DOM so
 * that any code path (useDocumentTitle, useAwaitingNotifications, …) that
 * sets the unread state is correctly reflected here without coordinating
 * through shared React state.
 */
export function hasUnreadFavicon(): boolean {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) return false;
  return link.href.includes('favicon-unread');
}
