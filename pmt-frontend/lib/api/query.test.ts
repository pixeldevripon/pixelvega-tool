import { describe, expect, it } from 'vitest';

import { buildQuery } from '@/lib/api/query';

/**
 * The cases that matter are the ABSENT ones. A filter that is not set and a
 * filter set to nothing must produce the same request, or a list screen quietly
 * asks the API a different question than the one the URL describes.
 */
describe('buildQuery', () => {
    it('returns an empty string when there is nothing to send', () => {
        // Not "?", which some servers treat as a distinct URL.
        expect(buildQuery({})).toBe('');
        expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('');
    });

    it('builds a scalar query string', () => {
        expect(buildQuery({ page: 2, q: 'acme', archived: false })).toBe(
            '?page=2&q=acme&archived=false',
        );
    });

    it('keeps `false` and `0`, which are values rather than absences', () => {
        // The bug this guards against is a truthiness check: `archived=false` is
        // a real filter and dropping it would silently list archived rows too.
        expect(buildQuery({ archived: false })).toBe('?archived=false');
        expect(buildQuery({ page: 0 })).toBe('?page=0');
    });

    it('repeats the key for an array', () => {
        expect(buildQuery({ projectTypes: ['WORDPRESS', 'SEO'] })).toBe(
            '?projectTypes=WORDPRESS&projectTypes=SEO',
        );
    });

    it('drops an empty array entirely', () => {
        // `?types=` and "no filter" must not be two different requests.
        expect(buildQuery({ projectTypes: [] })).toBe('');
    });

    it('drops empty entries inside an array', () => {
        expect(buildQuery({ t: ['A', '', undefined, 'B'] })).toBe('?t=A&t=B');
    });

    it('encodes values rather than trusting them', () => {
        expect(buildQuery({ q: 'a&b=c' })).toBe('?q=a%26b%3Dc');
    });

    it('encodes a value containing a comma, which a joined form could not', () => {
        // The reason arrays repeat the key instead of joining.
        expect(buildQuery({ t: ['a,b', 'c'] })).toBe('?t=a%2Cb&t=c');
    });
});
