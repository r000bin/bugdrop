import { describe, it, expect } from 'vitest';

describe('cropScreenshot', () => {
  it('is exported from screenshot module', async () => {
    const mod = await import('../src/widget/screenshot');
    expect(typeof mod.cropScreenshot).toBe('function');
  });

  it('getPixelRatio is exported from screenshot module', async () => {
    const mod = await import('../src/widget/screenshot');
    expect(typeof mod.getPixelRatio).toBe('function');
  });
});
