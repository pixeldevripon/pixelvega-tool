import { describe, expect, it } from 'vitest';

import { isApplePlatform, modifierKeyLabel } from './platform';

const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const IPAD =
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const LINUX =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

describe('isApplePlatform', () => {
    it('is true for macOS and for iPadOS', () => {
        expect(isApplePlatform(MAC)).toBe(true);
        expect(isApplePlatform(IPAD)).toBe(true);
    });

    it('is false for Windows and Linux', () => {
        // Both carry "AppleWebKit", which is exactly the trap a naive
        // /apple/i test falls into.
        expect(isApplePlatform(WINDOWS)).toBe(false);
        expect(isApplePlatform(LINUX)).toBe(false);
    });
});

describe('modifierKeyLabel', () => {
    it('advertises the command glyph on Apple platforms', () => {
        expect(modifierKeyLabel(MAC)).toBe('⌘');
        expect(modifierKeyLabel(IPAD)).toBe('⌘');
    });

    it('advertises Ctrl everywhere else', () => {
        expect(modifierKeyLabel(WINDOWS)).toBe('Ctrl');
        expect(modifierKeyLabel(LINUX)).toBe('Ctrl');
    });
});
