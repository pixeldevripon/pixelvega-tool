import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What is pinned here is the PAIRING of the two headers, because getting it
 * half right produces no error and no visible symptom.
 *
 * Sending `x-internal-api-key` without `x-real-client-ip` is the defect this
 * file shipped with: the backend's throttle bypass is scoped, so on any route
 * that declares its own `@Throttle()` the trusted caller is still tracked by IP,
 * and without the forwarded address every visitor is tracked as this server and
 * shares one bucket. That is precisely the failure the bypass exists to avoid,
 * and it only appears under load in production.
 *
 * The other half is that the IP must NEVER be sent without the secret: the
 * backend would ignore it, and sending it anyway would leak a visitor's address
 * to a call that has not identified itself.
 */

const mockHeaders = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ headers: mockHeaders }));
vi.mock('server-only', () => ({}));

function requestHeaders(entries: Record<string, string>) {
    return {
        get: (name: string) => entries[name.toLowerCase()] ?? null,
    };
}

async function build() {
    // Re-imported per case: the module reads process.env at call time, but the
    // mock has to be in place before the import resolves.
    const { serverAuthHeaders } = await import('@/lib/server/auth-headers');
    return serverAuthHeaders();
}

describe('serverAuthHeaders', () => {
    const original = process.env.INTERNAL_API_SECRET;

    beforeEach(() => {
        vi.resetModules();
        mockHeaders.mockReset();
    });

    afterEach(() => {
        if (original === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = original;
    });

    it('always forwards the session cookie', async () => {
        delete process.env.INTERNAL_API_SECRET;
        mockHeaders.mockResolvedValue(
            requestHeaders({ cookie: 'better-auth.session_token=abc.def' }),
        );

        const result = await build();

        expect(result.cookie).toBe('better-auth.session_token=abc.def');
    });

    it('sends an empty cookie rather than omitting it when there is none', async () => {
        // The backend reads `cookie` unconditionally; an absent key and an empty
        // string reach it the same way, and an empty string keeps the shape
        // stable for callers spreading this object.
        delete process.env.INTERNAL_API_SECRET;
        mockHeaders.mockResolvedValue(requestHeaders({}));

        expect((await build()).cookie).toBe('');
    });

    describe('with no internal secret configured', () => {
        beforeEach(() => {
            delete process.env.INTERNAL_API_SECRET;
        });

        it('sends neither the key nor the forwarded IP', async () => {
            // Unset means the bypass never triggers, so a deployment that
            // forgets the variable is throttled rather than open. Forwarding the
            // visitor's address then leaks it for no benefit: the backend
            // ignores the header without a valid secret.
            mockHeaders.mockResolvedValue(
                requestHeaders({
                    cookie: 'c=1',
                    'x-forwarded-for': '203.0.113.7',
                }),
            );

            const result = await build();

            expect(result['x-internal-api-key']).toBeUndefined();
            expect(result['x-real-client-ip']).toBeUndefined();
        });
    });

    describe('with an internal secret configured', () => {
        beforeEach(() => {
            process.env.INTERNAL_API_SECRET = 'a-real-looking-secret-value';
        });

        it('sends the key AND the forwarded IP together', async () => {
            mockHeaders.mockResolvedValue(
                requestHeaders({
                    cookie: 'c=1',
                    'x-forwarded-for': '203.0.113.7',
                }),
            );

            const result = await build();

            expect(result['x-internal-api-key']).toBe(
                'a-real-looking-secret-value',
            );
            expect(result['x-real-client-ip']).toBe('203.0.113.7');
        });

        it('takes the FIRST entry of an x-forwarded-for chain', async () => {
            // A chain reads "client, proxy1, proxy2". Taking the last entry
            // tracks the nearest proxy, which is one bucket for everyone behind
            // it: the same defect in a different place.
            mockHeaders.mockResolvedValue(
                requestHeaders({
                    'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178',
                }),
            );

            expect((await build())['x-real-client-ip']).toBe('203.0.113.7');
        });

        it('trims whitespace around a forwarded entry', async () => {
            mockHeaders.mockResolvedValue(
                requestHeaders({ 'x-forwarded-for': '  203.0.113.7 , 70.41.3.18' }),
            );

            expect((await build())['x-real-client-ip']).toBe('203.0.113.7');
        });

        it('falls back to x-real-ip, which proxies send unchained', async () => {
            mockHeaders.mockResolvedValue(
                requestHeaders({ 'x-real-ip': '198.51.100.4' }),
            );

            expect((await build())['x-real-client-ip']).toBe('198.51.100.4');
        });

        it('prefers x-forwarded-for when both are present', async () => {
            mockHeaders.mockResolvedValue(
                requestHeaders({
                    'x-forwarded-for': '203.0.113.7',
                    'x-real-ip': '198.51.100.4',
                }),
            );

            expect((await build())['x-real-client-ip']).toBe('203.0.113.7');
        });

        it('omits the IP header entirely when there is no forwarded address', async () => {
            // Local development: no proxy, no forwarded header. Sending an empty
            // value would give every request the SAME empty bucket key, which is
            // worse than sending nothing and letting the backend use req.ip.
            mockHeaders.mockResolvedValue(requestHeaders({ cookie: 'c=1' }));

            const result = await build();

            expect(result['x-internal-api-key']).toBeDefined();
            expect('x-real-client-ip' in result).toBe(false);
        });

        it('omits the IP header when the chain is empty or whitespace', async () => {
            mockHeaders.mockResolvedValue(
                requestHeaders({ 'x-forwarded-for': '  ,  ' }),
            );

            expect('x-real-client-ip' in (await build())).toBe(false);
        });
    });
});
