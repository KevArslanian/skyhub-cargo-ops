export type DensityAxis = "vertical" | "horizontal";

export type DensityMeasureOptions = {
  axis: DensityAxis;
  gapPx?: number;
  headSelector?: string;
  footerPx?: number;
};

function getContainerEdge(container: HTMLElement, axis: DensityAxis) {
  const rect = container.getBoundingClientRect();
  return axis === "vertical" ? rect.bottom : rect.right;
}

function itemFits(container: HTMLElement, item: HTMLElement, axis: DensityAxis) {
  const edge = getContainerEdge(container, axis);
  const rect = item.getBoundingClientRect();
  return axis === "vertical" ? rect.bottom <= edge + 1 : rect.right <= edge + 1;
}

export function countFittingItems(
  container: HTMLElement,
  itemSelector: string,
  axis: DensityAxis,
) {
  const items = container.querySelectorAll<HTMLElement>(itemSelector);
  if (!items.length) return 0;

  let fitting = 0;
  for (const item of items) {
    if (itemFits(container, item, axis)) {
      fitting += 1;
    } else {
      break;
    }
  }
  return fitting;
}

export function estimateFittingItems(
  container: HTMLElement,
  sample: HTMLElement | null,
  options: DensityMeasureOptions,
) {
  const gapPx = options.gapPx ?? 0;
  if (!sample) return 0;

  const sampleRect = sample.getBoundingClientRect();
  const sampleSize = options.axis === "vertical" ? sampleRect.height : sampleRect.width;
  if (sampleSize <= 0) return 0;

  let available = options.axis === "vertical" ? container.clientHeight : container.clientWidth;
  if (options.headSelector) {
    const head = container.querySelector<HTMLElement>(options.headSelector);
    if (head) {
      available -= head.getBoundingClientRect().height;
    }
  }
  if (options.footerPx) {
    available -= options.footerPx;
  }

  if (available <= 0) return 0;
  return Math.max(1, Math.floor((available + gapPx) / (sampleSize + gapPx)));
}

export function resolveVisibleCount(
  container: HTMLElement,
  itemSelector: string,
  options: DensityMeasureOptions & { fallback: number; min: number; max: number },
) {
  const sample = container.querySelector<HTMLElement>(itemSelector);
  const visible = countFittingItems(container, itemSelector, options.axis);
  const estimated = estimateFittingItems(container, sample, options);
  const raw = Math.max(visible, estimated);
  return raw > 0 ? Math.max(options.min, Math.min(options.max, raw)) : options.fallback;
}

export function subscribeViewportResize(
  container: HTMLElement | null,
  callback: () => void,
  extraTargets: (HTMLElement | null)[] = [],
) {
  const run = () => {
    callback();
    window.requestAnimationFrame(callback);
  };

  run();

  const observer = new ResizeObserver(run);
  if (container) observer.observe(container);
  for (const target of extraTargets) {
    if (target) observer.observe(target);
  }

  window.addEventListener("resize", run);
  window.visualViewport?.addEventListener("resize", run);
  window.visualViewport?.addEventListener("scroll", run);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", run);
    window.visualViewport?.removeEventListener("resize", run);
    window.visualViewport?.removeEventListener("scroll", run);
  };
}