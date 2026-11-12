/**
 * Waits on real conditions instead of fixed pauses (a pause is too short on a loaded CI runner
 * and needlessly long everywhere else).
 */

/** Polls a condition of the simulated backend (not of the page) until it holds, or fails saying which. */
export async function until(condition, what, timeout = 10_000) {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error(`e2e: timed out: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** No request for this long counts as "the screen got its data" (what Playwright calls network idle). */
const QUIET_MS = 300;

/**
 * Waits for real conditions instead of a fixed pause: no request to the simulated services in
 * flight for QUIET_MS (the Realtime socket is not a request), then no finite animation still running
 * (route transitions, sheets; endless ones such as skeleton shimmer do not count).
 */
export async function settle(page, inFlight, timeout = 15_000) {
  const end = Date.now() + timeout;
  let quietSince = null;
  while (quietSince === null || Date.now() - quietSince < QUIET_MS) {
    if (Date.now() > end) throw new Error(`e2e: still loading after ${timeout} ms: ${[...inFlight].map((r) => r.url()).join(', ')}`);
    quietSince = inFlight.size === 0 ? (quietSince ?? Date.now()) : null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout });
}
