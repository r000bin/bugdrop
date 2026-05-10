export interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EXPLICIT_SELECTOR = '[data-bugdrop-mask]';
const DEFAULT_SELECTOR =
  'input[type="password"], input[autocomplete*="cc-number"], input[autocomplete*="cc-csc"], input[autocomplete*="cc-exp"]';
const COMBINED_SELECTOR = `${EXPLICIT_SELECTOR}, ${DEFAULT_SELECTOR}`;

export function collectMaskRects(root: Element): MaskRect[] {
  // seen guards against future manual collection paths (Task 4 walk + root.matches)
  // revisiting an element. querySelectorAll alone never duplicates.
  const seen = new Set<Element>();
  const rects: MaskRect[] = [];
  const matches = root.querySelectorAll<HTMLElement>(COMBINED_SELECTOR);
  for (const el of matches) {
    if (seen.has(el)) continue;
    seen.add(el);
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
