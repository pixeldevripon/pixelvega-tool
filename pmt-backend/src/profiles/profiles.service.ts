import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Gender, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { COUNTRY_OPTIONS } from '@/common/constants/countries';
import * as FieldLength from '@/common/constants/field-lengths';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
} from '@/common/constants/password-policy';
import { AVATAR_MAX_SIZE_MB } from '@/uploads/upload-options';
import {
  GENDER_DISPLAY,
  ROLE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import { joinName } from '@/common/utils/name.util';
import { UpdateProfileRequestDto } from '@/profiles/dto/profile.dto';
import {
  mayDeleteOwnAccount,
  toOwnProfileResponse,
  toProfileResponse,
} from '@/profiles/profile.mapper';

const USER_WITH_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  country: true,
  gender: true,
  socialUrls: true,
  avatarUrl: true,
  role: true,
  status: true,
  slackUserId: true,
  createdAt: true,
  employeeProfile: true,
  clientProfile: true,
};

/**
 * What the connections list is built from.
 *
 * Deliberately three columns. `Account` also holds `accessToken`,
 * `refreshToken`, `idToken` and `password`, and a `select:` that grew into an
 * `include:` here would put every one of them on a response a browser reads.
 */
const ACCOUNT_SELECT = {
  providerId: true,
  accountId: true,
  createdAt: true,
};

/** better-auth's provider id for an email and password account. */
const CREDENTIAL_PROVIDER = 'credential';

/** The one connection this API can remove. See `disconnect` below. */
const SLACK_CONNECTION = 'SLACK';

function isClientRole(role: Role) {
  return role === Role.CLIENT;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Reference data for the account form: the two select lists, the password
   * policy and the two limits its copy quotes.
   *
   * Synchronous and constant. It is a route rather than a constant in the client
   * because the client must not own a country list, a gender list, the wording
   * of a password rule, or a size cap that multer enforces somewhere else (D4).
   */
  getOptions() {
    return {
      countries: COUNTRY_OPTIONS,
      genders: Object.values(Gender).map((gender) =>
        toEnumDisplay(GENDER_DISPLAY, gender),
      ),
      roles: Object.values(Role).map((role) =>
        toEnumDisplay(ROLE_DISPLAY, role),
      ),
      password: {
        minLength: PASSWORD_MIN_LENGTH,
        maxLength: FieldLength.PASSWORD_MAX,
        rules: PASSWORD_RULES.map((rule) => ({ ...rule })),
      },
      avatarMaxSizeMb: AVATAR_MAX_SIZE_MB,
      maxSocialUrls: FieldLength.MAX_SOCIAL_URLS,
    };
  }

  /**
   * Another person's profile, for a staffing lookup.
   *
   * Deliberately narrower than `findOwnProfile`: no connected accounts and no
   * capability flags. Both would be wrong here rather than merely surplus. See
   * `toOwnProfileResponse`.
   */
  async findByUserId(userId: string) {
    return toProfileResponse(await this.getUserOrThrow(userId));
  }

  /** The account screen's read. Everything above, plus the owner-only half. */
  async findOwnProfile(userId: string) {
    const user = await this.getUserOrThrow(userId);

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    return toOwnProfileResponse(user, accounts);
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_WITH_PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(userId: string, role: Role, dto: UpdateProfileRequestDto) {
    const {
      firstName,
      lastName,
      country,
      gender,
      socialUrls,
      ...profileFields
    } = dto;

    await this.updateUserFields(userId, {
      firstName,
      lastName,
      country,
      gender,
      socialUrls,
    });

    if (isClientRole(role)) {
      const { companyName, billingEmail, phone, timezone } = profileFields;
      await this.prisma.clientProfile.update({
        where: { userId },
        data: { companyName, billingEmail, phone, timezone },
      });
    } else {
      const {
        designation,
        phone,
        timezone,
        bio,
        currentStatus,
        availabilityStatus,
      } = profileFields;
      await this.prisma.employeeProfile.update({
        where: { userId },
        data: {
          designation,
          phone,
          timezone,
          bio,
          currentStatus,
          availabilityStatus,
        },
      });
    }

    const updatedProfileFields = Object.fromEntries(
      Object.entries(profileFields).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updatedProfileFields).length > 0) {
      await this.auditLog.log({
        userId,
        action: 'profile.updated',
        targetType: isClientRole(role) ? 'ClientProfile' : 'EmployeeProfile',
        targetId: userId,
        metadata: updatedProfileFields,
      });
    }

    return this.findOwnProfile(userId);
  }

  /**
   * The half of an update that lands on `User`, and the reason `name` is not a
   * settable field.
   *
   * `name` is what every other table, email and audit row reads, and it is
   * composed here from the two halves the form edits. Accepting all three would
   * let a caller store a full name contradicting its own parts, which then
   * renders differently depending on which screen you are on.
   *
   * `joinName` returns null when both halves end up empty, and that case leaves
   * `name` alone rather than blanking it: the column is NOT NULL and a person
   * with no name is a row nothing can render.
   */
  private async updateUserFields(
    userId: string,
    fields: {
      firstName?: string;
      lastName?: string;
      country?: string;
      gender?: Gender;
      socialUrls?: string[];
    },
  ) {
    // Nothing on the User row was supplied, so there is nothing to read and
    // nothing to write. Without this, a PATCH carrying only `bio` still spent a
    // query fetching a row it would not touch.
    if (Object.values(fields).every((value) => value === undefined)) {
      return;
    }

    const touchesName =
      fields.firstName !== undefined || fields.lastName !== undefined;

    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        firstName: true,
        lastName: true,
        country: true,
        gender: true,
        socialUrls: true,
      },
    });

    const firstName = fields.firstName?.trim() ?? existing.firstName;
    const lastName = fields.lastName?.trim() ?? existing.lastName;
    const composed = joinName({ firstName, lastName });

    const data = {
      ...(fields.firstName !== undefined && { firstName: firstName || null }),
      ...(fields.lastName !== undefined && { lastName: lastName || null }),
      // The empty string is the documented "clear it" signal for country; see
      // SELECTABLE_COUNTRY_CODES in the DTO.
      ...(fields.country !== undefined && { country: fields.country || null }),
      ...(fields.gender !== undefined && { gender: fields.gender }),
      ...(fields.socialUrls !== undefined && { socialUrls: fields.socialUrls }),
      ...(touchesName && composed !== null && { name: composed }),
    };

    if (Object.keys(data).length === 0) {
      return;
    }

    await this.prisma.user.update({ where: { id: userId }, data });

    // Both sides of every change, not just the new value. An audit row saying
    // `{ country: 'US' }` records that something changed without recording what
    // it was, which is the one question the log exists to answer.
    const changes = Object.fromEntries(
      Object.entries(data)
        .filter(
          ([key, value]) =>
            JSON.stringify(value) !==
            JSON.stringify(existing[key as keyof typeof existing]),
        )
        .map(([key, value]) => [
          key,
          { from: existing[key as keyof typeof existing] ?? null, to: value },
        ]),
    );
    if (Object.keys(changes).length > 0) {
      await this.auditLog.log({
        userId,
        action: 'user.updated',
        targetType: 'User',
        targetId: userId,
        metadata: { changes },
      });
    }
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, avatarPublicId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { url, publicId } = await this.cloudinary.upload(file, {
      folder: 'pmt/avatars',
      // Forced rather than left to detection: this is an avatar, and a video
      // that happened to pass the mimetype filter must not become one.
      resourceType: 'image',
    });

    if (user.avatarPublicId) {
      // Swallowed on purpose: a failed delete leaves an orphaned asset, which
      // is not worth failing the upload over. Logged so it is not invisible.
      await this.cloudinary
        .delete(user.avatarPublicId, 'image')
        .catch((error) =>
          this.logger.warn(
            `Failed to delete the replaced avatar ${user.avatarPublicId}: ${error}`,
          ),
        );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url, avatarPublicId: publicId },
    });

    await this.auditLog.log({
      userId,
      action: 'profile.avatar_updated',
      targetType: 'User',
      targetId: userId,
      metadata: { publicId },
    });

    return this.findOwnProfile(userId);
  }

  /**
   * Clear the avatar, and destroy the asset behind it.
   *
   * A separate method rather than `update({ avatarUrl: null })`: removing an
   * avatar has a side effect outside this database, and folding it into the
   * generic field update would hide a Cloudinary call inside a PATCH that
   * otherwise only writes columns.
   */
  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, avatarPublicId: true, avatarUrl: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.avatarPublicId) {
      await this.cloudinary
        .delete(user.avatarPublicId, 'image')
        .catch((error) =>
          this.logger.warn(
            `Failed to delete the removed avatar ${user.avatarPublicId}: ${error}`,
          ),
        );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarPublicId: null },
    });

    await this.auditLog.log({
      userId,
      action: 'profile.avatar_removed',
      targetType: 'User',
      targetId: userId,
    });

    return this.findOwnProfile(userId);
  }

  /**
   * Remove a connection.
   *
   * Only Slack is removable, and the refusal for the credential provider is
   * enforced here rather than left to the `canDisconnect` flag: that flag is
   * advisory (ADR 0002), and this route is reachable without a screen. Unlinking
   * the credential account would lock the person out of the only way in.
   */
  async disconnect(userId: string, provider: string) {
    const normalized = provider.toUpperCase();

    if (normalized !== SLACK_CONNECTION) {
      throw new BadRequestException(
        normalized === CREDENTIAL_PROVIDER.toUpperCase()
          ? 'The email and password sign-in cannot be disconnected. It is the only way into this account.'
          : `Unknown connection: ${provider}`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { slackUserId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.slackUserId) {
      throw new NotFoundException('Slack is not connected to this account');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { slackUserId: null },
    });
    await this.auditLog.log({
      userId,
      action: 'profile.connection_removed',
      targetType: 'User',
      targetId: userId,
      metadata: { provider: normalized },
    });
    this.logger.log(`User ${userId} disconnected ${normalized}`);

    return this.findOwnProfile(userId);
  }

  /**
   * Delete your own account.
   *
   * A soft delete, matching `UsersService.remove`: every time entry, work report
   * and audit row references this user, and a hard delete would either cascade
   * through the delivery record or fail on a foreign key. `deletedAt` is what
   * every read already filters on.
   *
   * Three things happen together, and the order matters. Sessions are destroyed
   * inside the same transaction as the delete, so there is no window where the
   * row is gone and a live cookie is still being accepted.
   */
  async deleteOwnAccount(
    userId: string,
    role: Role,
    confirmEmail: string,
  ): Promise<{ message: string }> {
    // Reads the same predicate `capabilities.canDeleteAccount` is built from.
    // A flag and its enforcement deriving the rule separately is how five
    // buttons in this codebase came to offer actions that answered 403.
    if (!mayDeleteOwnAccount(role)) {
      throw new ForbiddenException(
        'The system admin account cannot be deleted. There must always be a root account.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Case insensitive, because an email address is. Someone typing
    // "Dev@pixelvega.com" into the confirmation has confirmed.
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException(
        'That does not match the email on this account.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);

    // Written after the transaction on purpose: an audit row for a deletion that
    // then rolled back would be a lie, and this log is what an administrator
    // reads to find out where someone went.
    await this.auditLog.log({
      userId,
      action: 'user.deleted',
      targetType: 'User',
      targetId: userId,
      metadata: { selfService: true },
    });
    this.logger.log(`User ${userId} deleted their own account`);

    return { message: 'Account deleted.' };
  }

  // Called by UsersService right after a User row is created (invite flow).
  createForRole(userId: string, role: Role) {
    if (isClientRole(role)) {
      return this.prisma.clientProfile.create({ data: { userId } });
    }
    return this.prisma.employeeProfile.create({ data: { userId } });
  }
}
