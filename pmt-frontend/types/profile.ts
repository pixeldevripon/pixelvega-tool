import type { EnumDisplay } from '@/contexts/role-context';

/**
 * The profile shapes the API returns, from `profiles/dto/profile.dto.ts`.
 *
 * A role is an `EnumDisplay`, not a string union (ADR 0001). That is not a
 * cosmetic difference: the API sends `{ value, label, tone }`, so a type saying
 * `role: 'ADMIN'` makes `roleLabels[user.role]` compile and then render an empty
 * badge at runtime. That exact defect shipped in the frontend this replaced.
 */

/** Employee-only, present when the user has an `EmployeeProfile`. */
export interface EmployeeProfile {
    id: string;
    userId: string;
    designation: string | null;
    phone: string | null;
    timezone: string | null;
    bio: string | null;
    /** Sick, casual, WFH, onsite. */
    currentStatus: EnumDisplay;
    /** Ready or occupied. */
    availabilityStatus: EnumDisplay;
}

/** Client-only, present when the user has a `ClientProfile`. */
export interface ClientProfile {
    id: string;
    userId: string;
    companyName: string | null;
    billingEmail: string | null;
    phone: string | null;
    timezone: string | null;
}

/** `GET /profiles/me` and `GET /profiles/:userId`. */
export interface UserProfile {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: EnumDisplay;
    status: EnumDisplay;
    createdAt?: string;
    /**
     * Exactly one of these is set, decided by the role. The API knows which;
     * a screen should render whichever it finds rather than branching on the
     * role to guess.
     */
    employeeProfile?: EmployeeProfile | null;
    clientProfile?: ClientProfile | null;
}

/**
 * `PATCH /profiles/me`.
 *
 * Which fields the API accepts depends on whether the caller has an employee or
 * a client profile, so everything is optional here and the server decides. An
 * avatar is absent on purpose: it is a file upload to `POST /profiles/me/avatar`,
 * not a URL a client may set.
 */
export interface UpdateProfilePayload {
    /**
     * `null` only, deliberately. Clearing an avatar is a profile update;
     * SETTING one is a file upload to `POST /profiles/me/avatar`. Typing this
     * as `string` would let a caller point the avatar at any host.
     */
    avatarUrl?: null;
    name?: string;
    designation?: string;
    phone?: string;
    timezone?: string;
    bio?: string;
    currentStatus?: string;
    availabilityStatus?: string;
    companyName?: string;
    billingEmail?: string;
}
