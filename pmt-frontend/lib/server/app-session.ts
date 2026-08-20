import 'server-only';

import { cache } from 'react';

import { authClient } from '@/lib/auth-client';
import { serverAuthHeaders } from '@/lib/server/auth-headers';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

/**
 * An enum as the API sends it (ADR 0001). Never a bare string: `role` is
 * `{ value, label, tone }`, so `role.label` is what a badge renders and
 * `role.value` is what a comparison would use, on the rare occasion identity
 * rather than capability is the question.
 */
export interface EnumDisplay {
    value: string;
    label: string;
    tone: string;
}

/** Exactly what the app layout needs to render the shell and decide the gates. */
export interface AppSession {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    /** For display. Gate on `permissions`, never on this. */
    role: EnumDisplay;
    status: EnumDisplay;
    /**
     * True until the person replaces the temporary password their invite
     * created. The backend clears it from BOTH password paths, so it is a
     * reliable "this account is not set up yet" signal.
     */
    mustResetPassword: boolean;
    /**
     * The effective capability set. `undefined` on a transient fetch failure,
     * which `RoleProvider` treats as "fall back to the static role map" rather
     * than as "no permissions": denying everything on a network blip would
     * empty the sidebar for a valid session.
     */
    permissions?: string[];
}

/**
 * The layout's session load, in ONE parallel wave.
 *
 * Three calls, fired together rather than in sequence, because the layout needs
 * all three before it can render anything and a waterfall would triple the
 * cold-start wait:
 *
 * - better-auth's `getSession`, which proves the cookie is real
 * - `GET /users/me`, for the identity and `mustResetPassword`
 * - `GET /users/me/permissions`, the effective set the whole UI gates from
 *
 * ── Deliberately NOT cached across requests ──
 *
 * `cache()` dedupes within one render pass, which is what makes it safe for a
 * layout and a page to both call this. It does not persist between requests, and
 * that matters: caching a transient `null` would sign a valid user out until the
 * entry expired.
 *
 * ── Do not add fields the layout does not read ──
 *
 * The version this replaced fetched company and social records the layout never
 * touched, purely because a shared helper happened to return them. That was
 * cold-start latency on every full page load. Anything a single screen needs
 * belongs in that screen's own hook.
 */
export const getAppSession = cache(
    async (cookie: string): Promise<AppSession | null> => {
        if (!cookie) return null;

        try {
            const headers = serverAuthHeaders(cookie);
            const [sessionRes, userRes, permissionsRes] = await Promise.all([
                authClient.getSession({ fetchOptions: { headers } }),
                fetch(`${BACKEND_URL}/api/users/me`, { headers }),
                fetch(`${BACKEND_URL}/api/users/me/permissions`, { headers }),
            ]);

            if (!sessionRes.data?.user || !userRes.ok) return null;

            const user = await safeJson(userRes);
            if (!user) return null;

            const permissions = permissionsRes.ok
                ? await safeJson(permissionsRes)
                : null;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl ?? null,
                role: user.role,
                status: user.status,
                mustResetPassword: Boolean(user.mustResetPassword),
                permissions: Array.isArray(permissions?.permissions)
                    ? permissions.permissions
                    : undefined,
            };
        } catch {
            return null;
        }
    },
);
