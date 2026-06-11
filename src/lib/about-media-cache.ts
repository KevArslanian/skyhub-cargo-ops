import {
  ABOUT_MEDIA_CACHE_NAME,
  ABOUT_POSTER_URLS,
  ABOUT_SCRUB_MP4_LITE,
  ABOUT_SCRUB_WEBM_LITE,
} from "./about-media-constants";
import type { VideoPerfTier } from "./video-performance";

export type AboutMediaCacheStatus = "idle" | "loading" | "ready" | "failed";

type CacheListener = (status: AboutMediaCacheStatus) => void;

const blobUrls = new Map<string, string>();
let cacheStatus: AboutMediaCacheStatus = "idle";
let warmPromise: Promise<void> | null = null;
const listeners = new Set<CacheListener>();

function setStatus(next: AboutMediaCacheStatus) {
  cacheStatus = next;
  for (const listener of listeners) {
    listener(next);
  }
}

export function getAboutMediaCacheStatus() {
  return cacheStatus;
}

export function subscribeAboutMediaCache(listener: CacheListener) {
  listeners.add(listener);
  listener(cacheStatus);
  return () => {
    listeners.delete(listener);
  };
}

function runWhenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => task(), { timeout: 1800 });
    return;
  }
  window.setTimeout(task, 0);
}

async function cacheUrl(url: string) {
  if (typeof caches === "undefined") {
    return fetch(url);
  }

  const cache = await caches.open(ABOUT_MEDIA_CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) {
    return cached;
  }

  const response = await fetch(url);
  if (response.ok) {
    await cache.put(url, response.clone());
  }
  return response;
}

async function fetchToBlobUrl(url: string) {
  const existing = blobUrls.get(url);
  if (existing) {
    return existing;
  }

  const response = await cacheUrl(url);
  if (!response.ok) {
    throw new Error(`Failed to cache ${url}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.set(url, blobUrl);
  return blobUrl;
}

async function warmPosters() {
  for (const url of ABOUT_POSTER_URLS) {
    await cacheUrl(url);
  }
}

async function warmVideoSources() {
  const prefersWebm =
    typeof document !== "undefined" &&
    document.createElement("video").canPlayType('video/webm; codecs="vp9"') !== "";

  if (prefersWebm) {
    await fetchToBlobUrl(ABOUT_SCRUB_WEBM_LITE);
  }
  await fetchToBlobUrl(ABOUT_SCRUB_MP4_LITE);
}

export async function warmAboutMediaCache(tier: VideoPerfTier) {
  if (warmPromise) {
    return warmPromise;
  }

  warmPromise = (async () => {
    setStatus("loading");
    try {
      await warmPosters();
      if (tier !== "lite") {
        await new Promise<void>((resolve) => {
          runWhenIdle(() => {
            void warmVideoSources().finally(resolve);
          });
        });
      }
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  })();

  return warmPromise;
}

export function getCachedVideoSources(tier: VideoPerfTier) {
  if (tier === "lite" || cacheStatus !== "ready") {
    return null;
  }

  const webm = blobUrls.get(ABOUT_SCRUB_WEBM_LITE);
  const mp4 = blobUrls.get(ABOUT_SCRUB_MP4_LITE);

  if (!webm && !mp4) {
    return {
      webm: ABOUT_SCRUB_WEBM_LITE,
      mp4: ABOUT_SCRUB_MP4_LITE,
    };
  }

  return {
    webm: webm ?? ABOUT_SCRUB_WEBM_LITE,
    mp4: mp4 ?? ABOUT_SCRUB_MP4_LITE,
  };
}

export function revokeAboutMediaBlobUrls() {
  for (const url of blobUrls.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrls.clear();
}