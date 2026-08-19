import { formatFileSize } from '../file-size.util';

describe('formatFileSize', () => {
  it('keeps an absent size absent rather than inventing a zero', () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(undefined)).toBeNull();
  });

  it('does not treat zero bytes as absent', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('shows plain bytes below a kilobyte', () => {
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('steps up through every unit', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 ** 2)).toBe('1 MB');
    expect(formatFileSize(1024 ** 3)).toBe('1 GB');
    expect(formatFileSize(1024 ** 4)).toBe('1 TB');
  });

  it('carries the gigabyte tier the frontend copy lacked', () => {
    // The bug this replaces: no GB tier meant a 2 GB deliverable rendered as
    // "2048.0 MB".
    expect(formatFileSize(2 * 1024 ** 3)).toBe('2 GB');
  });

  it('shows one decimal for a partial unit, and none for a whole one', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('stops at terabytes rather than inventing a unit', () => {
    expect(formatFileSize(5 * 1024 ** 5)).toMatch(/TB$/);
  });
});
