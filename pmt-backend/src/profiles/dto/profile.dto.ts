import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AvailabilityStatus,
  EmployeeWorkStatus,
  Gender,
  Role,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { EnumDisplayDto, OptionDto } from '@/common/dto/display.dto';
import { COUNTRY_CODES } from '@/common/constants/countries';
import { PASSWORD_MIN_LENGTH } from '@/common/constants/password-policy';
import * as FieldLength from '@/common/constants/field-lengths';

const WORK_STATUSES = Object.values(EmployeeWorkStatus);
const AVAILABILITY_STATUSES = Object.values(AvailabilityStatus);

/**
 * Every country code, plus the empty string.
 *
 * The empty string is how a caller CLEARS the field. JSON has null, but the
 * global pipe runs with `whitelist` and `transform`, and threading a nullable
 * through `@IsOptional()` means "absent" and "explicitly null" stop being
 * distinguishable. One documented sentinel is a smaller contract than that, and
 * it matches how the select's placeholder option already behaves.
 */
const SELECTABLE_COUNTRY_CODES = ['', ...COUNTRY_CODES];

// ── Response DTOs ────────────────────────────────────────────────────────────

/**
 * The staff profile. Which of the two profile tables applies is derived live
 * from User.role, there is no stored flag, so exactly one of employeeProfile
 * and clientProfile is ever populated on a response.
 */
export class EmployeeProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiPropertyOptional({ example: 'Senior Developer', nullable: true })
  designation!: string | null;

  @ApiPropertyOptional({ example: '+8801700000000', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Asia/Dhaka', nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({
    example: 'Full stack, mostly WordPress.',
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    type: EnumDisplayDto,
    description: 'Whether they are working or on leave right now.',
  })
  currentStatus!: EnumDisplayDto;

  @ApiProperty({
    type: EnumDisplayDto,
    description:
      'An informational staffing signal only. Adding someone to a project is never blocked by it.',
  })
  availabilityStatus!: EnumDisplayDto;
}

export class ClientProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId!: string;

  @ApiPropertyOptional({ example: 'Acme Ltd', nullable: true })
  companyName!: string | null;

  @ApiPropertyOptional({ example: 'billing@acme.com', nullable: true })
  billingEmail!: string | null;

  @ApiPropertyOptional({ example: '+8801700000000', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'Asia/Dhaka', nullable: true })
  timezone!: string | null;
}

/**
 * What the account screen may offer, decided here rather than from a role
 * string in a browser (ADR 0002).
 *
 * Every flag reads the same predicate the service asserts with. Three of the
 * four are constant for a given caller and are still fields rather than
 * hardcoded `true`s in the client, because a flag that nobody computed is the
 * same defect as a wrong one.
 */
export class ProfileCapabilitiesDto {
  @ApiProperty({
    example: true,
    description:
      'Whether the personal fields, avatar and social links may be written. Held by every role: these routes only ever touch the caller.',
  })
  canEditProfile!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Always false today. An email is the account identity here: it is what an invite was sent to and what the audit log records, and changing it safely needs a verified two-inbox flow this API does not expose. An administrator changes it through PATCH /users/:userId.',
  })
  canChangeEmail!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Always false. Nobody may change their own role, which UsersService.update refuses. The field exists so the screen can say why the control is disabled rather than hide it.',
  })
  canChangeRole!: boolean;

  @ApiProperty({
    example: true,
    description:
      'False for the SYSTEM_ADMIN account, which can never delete itself: there must always be a root account.',
  })
  canDeleteAccount!: boolean;
}

/**
 * One thing linked to this account.
 *
 * Assembled from two different places on purpose. The credential row is
 * better-auth's, in the `Account` table; the Slack link is a member id cached on
 * the `User` row and is not an `Account` at all. A client should not have to
 * know that, so both arrive in one list with one shape.
 */
export class ConnectedAccountResponseDto {
  @ApiProperty({
    type: EnumDisplayDto,
    description: 'CREDENTIAL or SLACK, with its label and tone.',
  })
  provider!: EnumDisplayDto;

  @ApiPropertyOptional({
    example: 'developer@pixelvega.com',
    nullable: true,
    description:
      'What the connection is to, when there is something safe to show. Never a token or a secret.',
  })
  detail!: string | null;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  connectedAt!: Date;

  @ApiProperty({
    example: false,
    description:
      'False for the email and password credential, which is the only way into this account and must not be removable from a settings screen.',
  })
  canDisconnect!: boolean;
}

export class ProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'developer@pixelvega.com' })
  email!: string;

  @ApiProperty({
    example: 'Jabed Hossain',
    description:
      'The full name every other screen, email and audit row reads. Composed by the server from firstName and lastName; never written directly through this endpoint.',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Jabed', nullable: true })
  firstName!: string | null;

  @ApiPropertyOptional({ example: 'Hossain', nullable: true })
  lastName!: string | null;

  @ApiPropertyOptional({
    example: '+8801700000000',
    nullable: true,
    description:
      'Hoisted from whichever profile table applies, so a form binds to one field instead of branching on the role to find it.',
  })
  phone!: string | null;

  @ApiPropertyOptional({
    type: OptionDto,
    nullable: true,
    description:
      'ISO 3166-1 alpha-2 with its English name. Null when unset, and also when the stored code is no longer a country.',
  })
  country!: OptionDto | null;

  @ApiPropertyOptional({ type: EnumDisplayDto, nullable: true })
  gender!: EnumDisplayDto | null;

  @ApiProperty({
    type: [String],
    example: ['https://github.com/jabed', 'https://linkedin.com/in/jabed'],
    description: 'In the order they were saved. Empty rather than null.',
  })
  socialUrls!: string[];

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/pixelvega/image/upload/v1/avatars/abc.jpg',
    nullable: true,
    description:
      'Lives on User, shared across both profile types. Set via POST /profiles/me/avatar.',
  })
  avatarUrl!: string | null;

  @ApiProperty({ type: EnumDisplayDto })
  role!: EnumDisplayDto;

  @ApiProperty({ type: EnumDisplayDto })
  status!: EnumDisplayDto;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({
    type: EmployeeProfileResponseDto,
    nullable: true,
    description:
      'Populated for ADMIN, PROJECT_MANAGER, DEVELOPER and DESIGNER. Null for a CLIENT.',
  })
  employeeProfile!: EmployeeProfileResponseDto | null;

  @ApiPropertyOptional({
    type: ClientProfileResponseDto,
    nullable: true,
    description: 'Populated for a CLIENT. Null for everyone else.',
  })
  clientProfile!: ClientProfileResponseDto | null;
}

/**
 * The caller's OWN profile: everything above, plus what only the owner may see.
 *
 * A separate class rather than optional fields on `ProfileResponseDto`, because
 * the difference is a boundary. `GET /profiles/:userId` is a staffing lookup
 * open to anyone holding VIEW_USER_PROFILE, and neither of these belongs in one:
 * `connectedAccounts` would hand them another person's Slack member id, and every
 * capability flag answers "may the SUBJECT do this to their own account", so
 * canDeleteAccount on a colleague's profile reads as the opposite of what it
 * means.
 */
export class OwnProfileResponseDto extends ProfileResponseDto {
  @ApiProperty({ type: ProfileCapabilitiesDto })
  capabilities!: ProfileCapabilitiesDto;

  @ApiProperty({ type: [ConnectedAccountResponseDto] })
  connectedAccounts!: ConnectedAccountResponseDto[];
}

export class PasswordRuleResponseDto {
  @ApiProperty({
    example: 'MIN_LENGTH',
    description: 'Stable and machine readable. The only field to branch on.',
  })
  key!: string;

  @ApiProperty({ example: 'At least 12 characters' })
  label!: string;

  @ApiProperty({
    example: '[A-Z]',
    description:
      'A JavaScript regular expression source, compiled with no flags. The server enforces this exact pattern, so a client evaluating it while someone types is showing the real gate rather than a guess at it.',
  })
  pattern!: string;
}

export class PasswordPolicyResponseDto {
  @ApiProperty({ example: PASSWORD_MIN_LENGTH })
  minLength!: number;

  @ApiProperty({ example: FieldLength.PASSWORD_MAX })
  maxLength!: number;

  @ApiProperty({ type: [PasswordRuleResponseDto] })
  rules!: PasswordRuleResponseDto[];
}

/**
 * Everything the account form needs to render its selects, in one call.
 *
 * Separate from the profile itself because it is reference data: it is identical
 * for every caller and changes only when this API is deployed, so a client
 * caches it for the session instead of refetching 249 countries beside every
 * profile read.
 */
export class ProfileOptionsResponseDto {
  @ApiProperty({
    type: [OptionDto],
    description: 'ISO 3166-1 alpha-2, sorted by label, ready to render.',
  })
  countries!: OptionDto[];

  @ApiProperty({ type: [EnumDisplayDto] })
  genders!: EnumDisplayDto[];

  @ApiProperty({
    type: [EnumDisplayDto],
    description:
      "Every role the system has, for rendering the caller's own read-only role. Nobody may change their own role, so this is not a list of choices.",
  })
  roles!: EnumDisplayDto[];

  @ApiProperty({ type: PasswordPolicyResponseDto })
  password!: PasswordPolicyResponseDto;

  @ApiProperty({
    example: 5,
    description: 'The avatar size cap in megabytes, as multer enforces it.',
  })
  avatarMaxSizeMb!: number;

  @ApiProperty({
    example: FieldLength.MAX_SOCIAL_URLS,
    description: 'How many social links one person may list.',
  })
  maxSocialUrls!: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Account deleted.' })
  message!: string;
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * A superset of the User row and both profile tables. ProfilesService picks the
 * subset relevant to the caller's role and ignores the rest, so sending a
 * client-only field as a developer is a no-op rather than an error.
 *
 * Two fields are deliberately absent:
 *
 * - `name`, because it is composed from firstName and lastName. Accepting all
 *   three would let a caller save a full name that contradicts its own halves.
 * - `avatarUrl`, because each upload creates a new Cloudinary asset and deletes
 *   the previous one, which is not idempotent, so it is POST
 *   /profiles/me/avatar. Typing it as a settable string would also let a caller
 *   point their avatar at any host.
 */
export class UpdateProfileRequestDto {
  @ApiPropertyOptional({ example: 'Jabed', maxLength: FieldLength.NAME_PART })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.NAME_PART)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Hossain', maxLength: FieldLength.NAME_PART })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.NAME_PART)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Employee or Client',
    maxLength: FieldLength.PROFILE_PHONE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.PROFILE_PHONE)
  phone?: string;

  /**
   * `@IsIn` against the real list, not `@IsString` plus a length of 2.
   *
   * "ZZ" is two uppercase letters and is not a country. Without the allowlist
   * the column would accept it, `toCountryOption` would return null, and the
   * form would silently show nothing saved.
   */
  @ApiPropertyOptional({
    example: 'BD',
    description: 'ISO 3166-1 alpha-2. Send an empty string to clear it.',
  })
  @IsOptional()
  @IsString()
  @IsIn(SELECTABLE_COUNTRY_CODES, {
    message: 'country must be a valid ISO 3166-1 alpha-2 country code',
  })
  country?: string;

  @ApiPropertyOptional({ enum: Object.values(Gender) })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://github.com/jabed'],
    description:
      'The complete list, replacing whatever is stored. Send [] to clear it.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FieldLength.MAX_SOCIAL_URLS)
  @IsString({ each: true })
  @MaxLength(FieldLength.SOCIAL_URL, { each: true })
  // `require_protocol` so a bare "github.com/jabed" is refused rather than
  // stored and later rendered as a relative link that navigates inside the
  // dashboard. `require_tld` keeps an intranet hostname out of a public profile.
  @IsUrl(
    { require_protocol: true, require_tld: true, protocols: ['http', 'https'] },
    {
      each: true,
      message: 'each social URL must start with http:// or https://',
    },
  )
  socialUrls?: string[];

  @ApiPropertyOptional({
    description: 'Employee only',
    maxLength: FieldLength.PROFILE_DESIGNATION,
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.PROFILE_DESIGNATION)
  designation?: string;

  @ApiPropertyOptional({
    description: 'Employee or Client',
    example: 'Asia/Dhaka',
    maxLength: FieldLength.PROFILE_TIMEZONE,
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.PROFILE_TIMEZONE)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Employee only',
    maxLength: FieldLength.PROFILE_BIO,
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.PROFILE_BIO)
  bio?: string;

  @ApiPropertyOptional({ enum: WORK_STATUSES, description: 'Employee only' })
  @IsOptional()
  @IsEnum(EmployeeWorkStatus)
  currentStatus?: EmployeeWorkStatus;

  @ApiPropertyOptional({
    enum: AVAILABILITY_STATUSES,
    description: 'Employee only',
  })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({
    description: 'Client only',
    maxLength: FieldLength.CLIENT_COMPANY_NAME,
  })
  @IsOptional()
  @IsString()
  @MaxLength(FieldLength.CLIENT_COMPANY_NAME)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Client only' })
  @IsOptional()
  @IsEmail()
  @MaxLength(FieldLength.EMAIL)
  billingEmail?: string;
}

/**
 * Deleting your own account.
 *
 * The typed email is not security: the session already proves who is asking, and
 * anyone who can reach this route knows their own address. It is a deliberate
 * pause on an action with no undo, in the place where a misclick would otherwise
 * be enough. The service compares it against the session's email, so it also
 * catches the one case a confirmation dialog cannot: a request built against the
 * wrong account.
 */
export class DeleteAccountRequestDto {
  @ApiProperty({
    example: 'developer@pixelvega.com',
    description: "Must match the caller's own email exactly.",
  })
  @IsEmail()
  @MaxLength(FieldLength.EMAIL)
  confirmEmail!: string;
}
