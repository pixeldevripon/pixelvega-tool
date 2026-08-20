import type { EnumDisplay } from '@/contexts/role-context';

/**
 * The profile shapes the API returns, from `profiles/dto/profile.dto.ts`.
 *
 * A role is an `EnumDisplay`, not a string union (ADR 0001). That is not a
 * cosmetic difference: the API sends `{ value, label, tone }`, so a type saying
 * `role: 'ADMIN'` makes `roleLabels[user.role]` compile and then render an empty
 * badge at runtime. That exact defect shipped in the frontend this replaced.
 */

/** A choice in a select. No tone: there is nothing about a country to grade. */
export interface Option {
    value: string;
    label: string;
}

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

/**
 * What the account screen may offer.
 *
 * Read these; never re-derive them from `role.value`. Three of the four are
 * constant for a given caller and are still fields rather than literals here,
 * because a flag nobody computed is the same defect as a wrong one.
 */
export interface ProfileCapabilities {
    canEditProfile: boolean;
    canChangeEmail: boolean;
    canChangeRole: boolean;
    canDeleteAccount: boolean;
}

/** One thing linked to the account: the credential, or Slack. */
export interface ConnectedAccount {
    provider: EnumDisplay;
    /** Never a token. Null for the credential account. */
    detail: string | null;
    connectedAt: string;
    canDisconnect: boolean;
}

/** `GET /profiles/me` and `GET /profiles/:userId`. */
export interface UserProfile {
    id: string;
    email: string;
    /** Composed by the server from the two halves below. Read only here. */
    name: string;
    firstName: string | null;
    lastName: string | null;
    /** Hoisted out of whichever profile table applies, so a form binds to one field. */
    phone: string | null;
    country: Option | null;
    gender: EnumDisplay | null;
    socialUrls: string[];
    avatarUrl: string | null;
    role: EnumDisplay;
    status: EnumDisplay;
    createdAt: string;
    capabilities: ProfileCapabilities;
    connectedAccounts: ConnectedAccount[];
    /**
     * Exactly one of these is set, decided by the role. The API knows which;
     * a screen should render whichever it finds rather than branching on the
     * role to guess.
     */
    employeeProfile?: EmployeeProfile | null;
    clientProfile?: ClientProfile | null;
}

/**
 * One password requirement, with the wording AND the pattern the server
 * enforces.
 *
 * The pattern is here so the checklist a user types against is the real gate
 * rather than a guess at it. Compile it and test the value; do not write a rule
 * of your own beside it.
 */
export interface PasswordRule {
    key: string;
    label: string;
    /** A regular expression source, to be compiled with no flags. */
    pattern: string;
}

export interface PasswordPolicy {
    minLength: number;
    maxLength: number;
    rules: PasswordRule[];
}

/**
 * `GET /profiles/options`.
 *
 * Reference data: identical for every caller and changes only on deploy, so it
 * is cached for the session rather than refetched beside every profile read.
 */
export interface ProfileOptions {
    countries: Option[];
    genders: EnumDisplay[];
    roles: EnumDisplay[];
    password: PasswordPolicy;
    avatarMaxSizeMb: number;
    maxSocialUrls: number;
}

/**
 * `PATCH /profiles/me`.
 *
 * Which fields the API accepts depends on whether the caller has an employee or
 * a client profile, so everything is optional here and the server decides.
 *
 * Two fields are deliberately absent. `name` is composed by the server from
 * `firstName` and `lastName`, so sending it would let the stored full name
 * contradict its own halves. `avatarUrl` is a file upload to
 * `POST /profiles/me/avatar`, not a URL a client may set: typing it as a string
 * would let a caller point the avatar at any host.
 */
export interface UpdateProfilePayload {
    firstName?: string;
    lastName?: string;
    phone?: string;
    /** An ISO 3166-1 alpha-2 code, or the empty string to clear it. */
    country?: string;
    gender?: string;
    /** The complete list, replacing what is stored. `[]` clears it. */
    socialUrls?: string[];
    designation?: string;
    timezone?: string;
    bio?: string;
    currentStatus?: string;
    availabilityStatus?: string;
    companyName?: string;
    billingEmail?: string;
}

/** One live session, from `GET /profiles/me/sessions`. */
export interface ProfileSession {
    id: string;
    isCurrent: boolean;
    /** "Chrome on macOS", parsed by the server. Null when it could not be identified. */
    device: string | null;
    ipAddress: string | null;
    createdAt: string;
    expiresAt: string;
    capabilities: { canRevoke: boolean };
}

/** `DELETE /profiles/me/sessions/others`. */
export interface RevokedSessions {
    revoked: number;
    /** Written by the server, plural and all. Render it verbatim. */
    message: string;
}
