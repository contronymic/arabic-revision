// Browser features that can be missing, or can throw when site data is blocked.
// None of them is essential, so a failure here never stops the site starting.

export function getStorage(win) {
  try {
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

// The offline copy (the service worker) and a request to keep this site's storage.
export function startOfflineCopy(nav) {
  try {
    nav.serviceWorker?.register('./sw.js').catch(() => {});
  } catch {
    // No offline copy in this browser; the site still works online.
  }
  try {
    nav.storage?.persist?.()?.catch(() => {});
  } catch {
    // Nothing to do.
  }
}

export function checkForUpdate(nav) {
  try {
    nav.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  } catch {
    // Nothing to do.
  }
}

// Only Safari on iPhone and iPad has navigator.standalone.
export function isStandalone(nav) {
  try {
    return nav.standalone;
  } catch {
    return undefined;
  }
}
