export const ABOUT_MEDIA_CACHE_NAME = "skyhub-about-media-v1";

export const ABOUT_POSTER_URLS = [
  "/media/about/sky-clouds.jpg",
  "/media/about/takeoff-sunrise.jpg",
  "/media/about/data-network.jpg",
  "/media/about/city-aerial.jpg",
] as const;

export const ABOUT_SCRUB_POSTER = "/media/about/sky-clouds.jpg";

export const ABOUT_SCRUB_MP4_LITE = "/media/about/sky-clouds-lite.mp4";

export const ABOUT_SCRUB_WEBM_LITE = "/media/about/sky-clouds-lite.webm";

export const ABOUT_SCRUB_VIDEO_SOURCES = {
  poster: ABOUT_SCRUB_POSTER,
  mp4: ABOUT_SCRUB_MP4_LITE,
  webm: ABOUT_SCRUB_WEBM_LITE,
} as const;