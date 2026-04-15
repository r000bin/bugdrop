// test/theme.test.ts
import { describe, it, expect } from 'vitest';
import { isValidTheme, resolveTheme } from '../src/widget/theme';

describe('theme module', () => {
  it('module loads', () => {
    expect(typeof resolveTheme).toBe('function');
  });
});

describe('isValidTheme', () => {
  it.each(['light', 'dark', 'auto'])('accepts %s', value => {
    expect(isValidTheme(value)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['unknown string', 'blue'],
    ['undefined', undefined],
    ['null', null],
    ['number', 5],
    ['boolean', true],
    ['object', {}],
    ['array', []],
  ])('rejects %s', (_label, value) => {
    expect(isValidTheme(value)).toBe(false);
  });
});
