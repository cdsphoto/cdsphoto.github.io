(() => {
  'use strict';

  // Register the service worker (relative to this page, so it works at any base).
  if ('serviceWorker' in navigator) {
    // A page already open when a new deploy lands keeps running the JS it
    // already loaded into memory — clients.claim() in sw.js lets the new
    // worker start controlling that tab, but it can't retroactively re-run
    // already-executed <script> tags. Without this, a visitor with the tab
    // open across a deploy sees stale behavior with no indication anything
    // changed. This reloads once when that handoff happens, picking up the
    // fresh page automatically. Safe on a first-ever visit: a page is only
    // ever "controlled" by a service worker that was already active before
    // that page's own initial load, so controllerchange only fires here on
    // an actual old-to-new handoff, never on first install.
    let refreshedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshedForUpdate) return;
      refreshedForUpdate = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  const banner = document.querySelector('.install-prompt');
  if (!banner) return;

  const acceptBtn = banner.querySelector('.install-accept');
  const dismissBtn = banner.querySelector('.install-dismiss');
  const textEl = banner.querySelector('.install-text span');
  const DISMISS_KEY = 'cds-install-dismissed';

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
  const alreadyDismissed = (() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { return false; }
  })();

  let deferredPrompt = null;

  const show = () => banner.removeAttribute('hidden');
  const hide = () => banner.setAttribute('hidden', '');
  const remember = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) {} };

  if (isStandalone || alreadyDismissed) return; // already installed or user opted out

  // Android / desktop Chrome & Edge: capture the native prompt.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (acceptBtn) acceptBtn.hidden = false;
    window.setTimeout(show, 1200);
  });

  // iOS Safari has no beforeinstallprompt — offer Add to Home Screen instructions.
  if (isiOS) {
    if (acceptBtn) acceptBtn.hidden = true;
    if (textEl) textEl.textContent = 'Tap the Share icon, then “Add to Home Screen”.';
    window.setTimeout(show, 1600);
  }

  acceptBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_) {}
    deferredPrompt = null;
    hide();
  });

  dismissBtn?.addEventListener('click', () => { remember(); hide(); });

  window.addEventListener('appinstalled', () => { remember(); hide(); });
})();
