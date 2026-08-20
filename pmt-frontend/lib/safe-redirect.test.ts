import { describe, expect, it } from 'vitest';

import { DEFAULT_REDIRECT, safeRedirect } from '@/lib/safe-redirect';

/**
 * An open redirect on a sign-in page is a phishing primitive: it lets an
 * attacker send a real link to the real login page that lands on their page
 * once the password has been typed. Every case below is a shape that has been
 * used to get past a naive "does it start with a slash" check.
 */
describe('safeRedirect', () => {
    describe('allows', () => {
        it('the app root', () => {
            expect(safeRedirect('/')).toBe('/');
        });

        it('a module path with its query string', () => {
            expect(safeRedirect('/projects?status=IN_PROGRESS&page=2')).toBe(
                '/projects?status=IN_PROGRESS&page=2',
            );
        });

        it('a path with a fragment', () => {
            expect(safeRedirect('/projects/abc#members')).toBe(
                '/projects/abc#members',
            );
        });

        it('a nested settings path', () => {
            expect(safeRedirect('/settings/blocker-reasons')).toBe(
                '/settings/blocker-reasons',
            );
        });

        it('a path that merely shares a prefix with a refused one', () => {
            // `/loginish` is not `/login`. A bare startsWith would reject a
            // legitimate future route on a coincidence.
            expect(safeRedirect('/loginish')).toBe('/loginish');
        });
    });

    describe('refuses, falling back to the app root', () => {
        it.each([
            ['an absolute URL on another host', 'https://evil.example/harvest'],
            ['a protocol relative URL', '//evil.example/harvest'],
            ['a backslash protocol relative URL', String.raw`/\evil.example`],
            ['a double backslash', String.raw`\\evil.example`],
            ['a bare relative path', 'projects'],
            ['a javascript URL', 'javascript:alert(1)'],
            ['a data URL', 'data:text/html,<script>alert(1)</script>'],
        ])('%s', (_label, input) => {
            expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
        });

        it('a newline, which can split a header', () => {
            expect(
                safeRedirect('/projects\nLocation: https://evil.example'),
            ).toBe(DEFAULT_REDIRECT);
        });

        it('a tab', () => {
            expect(safeRedirect('/projects\tx')).toBe(DEFAULT_REDIRECT);
        });

        it('a null byte', () => {
            expect(safeRedirect('/projects' + '\u0000')).toBe(DEFAULT_REDIRECT);
        });
    });

    describe('refuses the signed-out screens', () => {
        // Not a security case: sending a freshly signed-in user to /login is a
        // loop, and /set-password is a token flow they cannot complete without
        // a token.
        it.each([
            '/login',
            '/login/forgot',
            '/set-password',
            '/reset-password',
        ])('%s', (input) => {
            expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
        });

        it('even with a query string attached', () => {
            expect(safeRedirect('/login?next=%2Fprojects')).toBe(
                DEFAULT_REDIRECT,
            );
        });
    });

    describe('missing input', () => {
        it.each([
            ['undefined', undefined],
            ['null', null],
            ['an empty string', ''],
        ])('%s falls back', (_label, input) => {
            expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
        });
    });

    it('honours an explicit fallback', () => {
        // The sign-in card passes its own, so a caller is never forced to use
        // the module default.
        expect(safeRedirect('https://evil.example', '/projects')).toBe(
            '/projects',
        );
    });
});
