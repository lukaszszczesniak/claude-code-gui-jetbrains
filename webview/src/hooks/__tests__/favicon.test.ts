import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FAVICON_DEFAULT,
  FAVICON_UNREAD,
  hasUnreadFavicon,
  restoreDefaultFavicon,
  setUnreadFavicon,
} from '../favicon';

let link: HTMLLinkElement;

beforeEach(() => {
  link = document.createElement('link');
  link.rel = 'icon';
  link.href = FAVICON_DEFAULT;
  document.head.appendChild(link);
});

afterEach(() => {
  link.remove();
});

describe('favicon helpers', () => {
  it('setUnreadFavicon swaps the href to the unread variant', () => {
    setUnreadFavicon();
    expect(link.href).toContain(FAVICON_UNREAD);
  });

  it('restoreDefaultFavicon swaps the href back to the default', () => {
    setUnreadFavicon();
    restoreDefaultFavicon();
    expect(link.href).toContain(FAVICON_DEFAULT);
    expect(link.href).not.toContain('favicon-unread');
  });

  it('hasUnreadFavicon reflects the live DOM state', () => {
    expect(hasUnreadFavicon()).toBe(false);
    setUnreadFavicon();
    expect(hasUnreadFavicon()).toBe(true);
    restoreDefaultFavicon();
    expect(hasUnreadFavicon()).toBe(false);
  });

  it('setUnreadFavicon is idempotent', () => {
    setUnreadFavicon();
    const after = link.href;
    setUnreadFavicon();
    expect(link.href).toBe(after);
  });
});
