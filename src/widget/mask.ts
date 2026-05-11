interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EXPLICIT_SELECTOR =
  '[data-bugdrop-mask], [data-bugdrop-redact], [data-bd-redact], [data-bugdrop-redacted]';
const DEFAULT_SELECTOR =
  'input[type="password"], input[autocomplete*="cc-number"], input[autocomplete*="cc-csc"], input[autocomplete*="cc-exp"]';

function shouldMask(el: Element): boolean {
  return el.matches(EXPLICIT_SELECTOR) || el.matches(DEFAULT_SELECTOR);
}

function pushRect(el: Element, rects: MaskRect[]): void {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  rects.push({
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    w: rect.width,
    h: rect.height,
  });
}

export function collectMaskRects(root: Element): MaskRect[] {
  const rects: MaskRect[] = [];

  if (shouldMask(root)) {
    pushRect(root, rects);
    return rects;
  }

  walk(root, rects);
  return rects;
}

export function countMaskRects(root: Element = document.body, area?: DOMRect): number {
  const rects = collectMaskRects(root);
  if (!area) return rects.length;
  return rects.filter(rect => intersects(rect, area)).length;
}

function intersects(rect: MaskRect, area: DOMRect): boolean {
  return (
    rect.x < area.x + area.width &&
    rect.x + rect.w > area.x &&
    rect.y < area.y + area.height &&
    rect.y + rect.h > area.y
  );
}

function walk(node: Element, rects: MaskRect[]): void {
  for (const child of Array.from(node.children)) {
    if (shouldMask(child)) {
      pushRect(child, rects);
      // Top-most-ancestor rule: do not descend into masked subtrees.
      continue;
    }
    walk(child, rects);
  }
}

export function translateMaskRect(
  rect: MaskRect,
  pixelRatio: number,
  originOffset: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): MaskRect {
  const rawX = (rect.x - originOffset.x) * pixelRatio;
  const rawY = (rect.y - originOffset.y) * pixelRatio;
  const rawW = rect.w * pixelRatio;
  const rawH = rect.h * pixelRatio;

  const x = Math.max(0, Math.floor(rawX) - 1);
  const y = Math.max(0, Math.floor(rawY) - 1);
  const right = Math.min(canvasWidth, Math.ceil(rawX + rawW) + 1);
  const bottom = Math.min(canvasHeight, Math.ceil(rawY + rawH) + 1);

  return {
    x,
    y,
    w: right - x,
    h: bottom - y,
  };
}

export async function applyMaskToImage(
  dataUrl: string,
  rects: MaskRect[],
  pixelRatio: number,
  originOffset: { x: number; y: number } = { x: 0, y: 0 }
): Promise<string> {
  if (rects.length === 0) return dataUrl;

  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000';
  for (const rect of rects) {
    const t = translateMaskRect(rect, pixelRatio, originOffset, canvas.width, canvas.height);
    if (!(t.w > 0 && t.h > 0)) continue;
    ctx.fillRect(t.x, t.y, t.w, t.h);
  }

  return canvas.toDataURL('image/png');
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to apply privacy masks'));
    img.src = dataUrl;
  });
}
