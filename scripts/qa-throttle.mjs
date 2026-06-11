/**
 * Shared QA throttle — max 2 concurrent requests, min gap between calls.
 * Import from other qa-*.mjs scripts to avoid server burst/overload.
 */

const state = {
  active: 0,
  lastDoneAt: 0,
  queue: [],
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForIdle({ minGapMs = 800, maxConcurrent = 2 } = {}) {
  while (state.active >= maxConcurrent) {
    await sleep(50);
  }
  const elapsed = Date.now() - state.lastDoneAt;
  if (elapsed < minGapMs) {
    await sleep(minGapMs - elapsed);
  }
}

export async function withThrottle(fn, options = {}) {
  const { minGapMs = 800, maxConcurrent = 2, retries = 3, retryBaseMs = 1500 } = options;

  await waitForIdle({ minGapMs, maxConcurrent });
  state.active += 1;

  try {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) {
          await sleep(retryBaseMs * Math.pow(1.5, attempt));
        }
      }
    }
    throw lastError;
  } finally {
    state.active -= 1;
    state.lastDoneAt = Date.now();
  }
}

export async function throttledFetch(url, init = {}, options = {}) {
  return withThrottle(async () => {
    const response = await fetch(url, init);
    return response;
  }, options);
}

export async function waitForServer(baseUrl, { path = "/login", timeoutMs = 30000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await throttledFetch(new URL(path, baseUrl).toString(), { method: "GET" });
      if (response.ok || response.status === 401 || response.status === 302) {
        return true;
      }
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`Server not ready at ${baseUrl} within ${timeoutMs}ms`);
}