// test/theme.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../src/widget/theme';

describe('theme module', () => {
  it('module loads', () => {
    expect(typeof resolveTheme).toBe('function');
  });
});
