'use client';

/**
 * Which features the server has switched on.
 *
 * Fetched rather than baked in, because the flag lives on the API and
 * mirroring it into a `NEXT_PUBLIC_` build variable would be a second source
 * of truth that drifts. The cost of that choice is a round trip, and the cost
 * of the round trip was visible: the menu painted, then the Learn button
 * appeared a beat later, which reads as the page still loading after it has
 * finished.
 *
 * So this is stale-while-revalidate against `localStorage`, the same shape
 * `serverProfile` uses. **The last answer renders immediately** and the request
 * that follows only confirms it. A feature flag changes when somebody deploys,
 * which is roughly never from a browser's point of view, so serving yesterday's
 * answer for the width of one fetch costs nothing — and a first-time visitor
 * still waits exactly as long as they did before, no worse.
 *
 * Wrong in one direction only, deliberately: a flag that was on and is now off
 * shows a Learn button for one paint before it corrects itself. The reverse —
 * assuming off — is what produced the flash in the first place.
 */

const KEY = 'keymania.features.v1';

export interface Features {
  learn: boolean;
}

const NONE: Features = { learn: false };

const listeners = new Set<() => void>();
let cached: Features | null = null;
let inflight: Promise<void> | null = null;
let hydrated = false;

/** Stable reference: `useSyncExternalStore` compares by identity. */
function read(): Features {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Features>) : null;
    cached = parsed ? { learn: Boolean(parsed.learn) } : NONE;
  } catch {
    cached = NONE;
  }
  return cached;
}

function publish(next: Features) {
  /* Same answer, same object: a fresh one every poll would re-render the menu. */
  if (cached && cached.learn === next.learn) return;
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Private mode. The flag still works, it just is not remembered. */
  }
  listeners.forEach((notify) => notify());
}

/** Ask the server, once per page, in the background. */
export function refreshFeatures(): void {
  if (inflight) return;
  inflight = fetch('/api/features')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.features) publish({ learn: Boolean(data.features.learn) });
    })
    .catch(() => {
      /* Offline. Whatever was cached stands, which is the right answer here:
         the flag has not changed just because this browser cannot reach it. */
    })
    .finally(() => { inflight = null; });
}

export function subscribeFeatures(notify: () => void): () => void {
  listeners.add(notify);
  if (!hydrated) {
    hydrated = true;
    refreshFeatures();
  }
  return () => { listeners.delete(notify); };
}

export const featuresSnapshot = (): Features => read();

/** Nothing is on until the client says so — the server cannot know. */
export const featuresServerSnapshot = (): Features => NONE;
