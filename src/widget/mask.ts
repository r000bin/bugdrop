export interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MASK_SELECTOR = '[data-bugdrop-mask]';

export function collectMaskRects(root: Element): MaskRect[] {
  const rects: MaskRect[] = [];
  const matches = root.querySelectorAll<HTMLElement>(MASK_SELECTOR);
  for (const el of matches) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    rects.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }
  return rects;
}

export async function applyMaskToImage(
  dataUrl: string,
  _rects: MaskRect[],
  _pixelRatio: number,
  _originOffset?: { x: number; y: number }
): Promise<string> {
  return dataUrl;
}
