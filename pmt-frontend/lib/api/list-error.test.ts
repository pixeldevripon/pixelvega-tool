import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/humane-error';
import { listErrorDescription } from '@/lib/api/list-error';

/**
 * Six list screens wrote this ternary out longhand. The `instanceof` guard is
 * the part that must not diverge: TanStack types `error` as `unknown`, so a copy
 * reaching straight for `.message` renders "undefined" on a non-Error rejection.
 */

describe('listErrorDescription', () => {
    it('shows an ApiError message verbatim', () => {
        // The contract of `ApiError.message` is that it is safe to show a
        // person as-is. That is the whole reason `apiFetch` throws one.
        expect(
            listErrorDescription(new ApiError('That project is archived.', 409)),
        ).toBe('That project is archived.');
    });

    it('falls back for a plain Error, whose text is not a sentence', () => {
        // "Failed to fetch" is not something anybody can act on, and it is what
        // the transport layer throws.
        expect(listErrorDescription(new Error('Failed to fetch'))).toBe(
            'Please try again.',
        );
    });

    it('falls back for a rejection that is not an Error at all', () => {
        // The case the hand written ternary got wrong: `.message` on any of
        // these is undefined, and "undefined" reaches the screen.
        for (const thrown of [undefined, null, 'a string', 42, { a: 1 }]) {
            expect(listErrorDescription(thrown)).toBe('Please try again.');
        }
    });

    it('takes a caller supplied fallback', () => {
        expect(listErrorDescription(new Error('x'), 'Try a wider range.')).toBe(
            'Try a wider range.',
        );
    });

    it('prefers the ApiError message over the fallback', () => {
        expect(
            listErrorDescription(new ApiError('Too many requests.', 429), 'nope'),
        ).toBe('Too many requests.');
    });
});
