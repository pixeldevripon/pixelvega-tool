import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { ProfilesService } from '@/profiles/profiles.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { auth } from '@/auth/instance/auth.instance';
import { generateUnusedPassword } from '@/common/utils/password.util';
import { splitName } from '@/common/utils/name.util';
import { paginate } from '@/common/utils/pagination.util';
import { toUserResponse } from '@/users/user.mapper';
import { QueryUsersDto } from '@/users/dto/user.dto';
import {
  InviteUserRequestDto,
  UpdateUserRequestDto,
} from '@/users/dto/user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  slackUserId: true,
  mustResetPassword: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly profiles: ProfilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(query: QueryUsersDto) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;
    const where = { deletedAt: null };

    const result = await paginate(
      (args) =>
        this.prisma.user.findMany({
          where,
          select: USER_SELECT,
          orderBy: { [sortBy]: sortOrder },
          ...args,
        }),
      () => this.prisma.user.count({ where }),
      page,
      pageSize,
    );

    return { ...result, items: result.items.map(toUserResponse) };
  }

  async findOne(id: string) {
    return toUserResponse(await this.getUserOrThrow(id));
  }

  /**
   * The raw row, for the protection rules to compare against.
   *
   * Deliberately NOT `findOne`. Every `existing.role === Role.SYSTEM_ADMIN`
   * check below compares against a Prisma enum, and `findOne` returns `role`
   * as a display object. Routing the internal lookups through the mapped
   * version turned every one of those comparisons into object-versus-string,
   * which is silently false: the SYSTEM_ADMIN protections and the peer-ADMIN
   * rule both stopped firing. Keep the two separate.
   */
  private async getUserOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: string,
    dto: UpdateUserRequestDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getUserOrThrow(id);

    if (
      dto.role !== undefined &&
      dto.role !== existing.role &&
      id === actorId
    ) {
      throw new ForbiddenException('You cannot change your own role');
    }
    if (
      existing.role === Role.SYSTEM_ADMIN &&
      actorRole !== Role.SYSTEM_ADMIN
    ) {
      throw new ForbiddenException(
        'The system admin account cannot be modified',
      );
    }
    if (
      existing.role === Role.ADMIN &&
      actorRole !== Role.SYSTEM_ADMIN &&
      id !== actorId
    ) {
      throw new ForbiddenException('Only the system admin can modify an admin');
    }
    // Defence in depth. `ASSIGNABLE_ROLES` in user.dto.ts already rejects this
    // at validation, and that is the primary control, but a privilege boundary
    // this important must not rest on a single decorator someone could relax
    // without realising what it was holding up. SYSTEM_ADMIN is a single
    // account bootstrapped on first boot and is never assignable through the API.
    if (dto.role === Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'The system admin role cannot be assigned through the API',
      );
    }
    if (dto.role === Role.ADMIN && actorRole !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only the system admin can promote a user to ADMIN',
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        // An admin writing a full name here has to leave the two halves the
        // account screen edits consistent with it, or that screen opens showing
        // a name the rest of the app disagrees with. `name.util.ts` documents
        // both directions of this; `ProfilesService` walks the other one.
        ...(dto.name !== undefined && splitName(dto.name)),
      },
      select: USER_SELECT,
    });

    const changes: Record<string, { from: string | null; to: string | null }> =
      {};
    for (const key of ['name', 'role', 'status', 'slackUserId'] as const) {
      if (dto[key] !== undefined && dto[key] !== existing[key]) {
        changes[key] = { from: existing[key], to: dto[key] };
      }
    }
    if (Object.keys(changes).length > 0) {
      await this.auditLog.log({
        userId: actorId,
        action: 'user.updated',
        targetType: 'User',
        targetId: id,
        metadata: { changes },
      });
    }

    if (dto.status === 'SUSPENDED') {
      await this.prisma.session.deleteMany({ where: { userId: id } });
    }

    return toUserResponse(user);
  }

  async remove(id: string, actorId: string, actorRole: Role) {
    const existing = await this.getUserOrThrow(id);

    if (existing.role === Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'The system admin account cannot be deleted',
      );
    }
    if (existing.role === Role.ADMIN && actorRole !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only the system admin can delete an admin');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.auditLog.log({
      userId: actorId,
      action: 'user.deleted',
      targetType: 'User',
      targetId: id,
    });
    this.logger.log(`User ${id} deleted by ${actorId}`);
    return { message: 'User deleted.' };
  }

  async invite(
    dto: InviteUserRequestDto,
    invitedById: string,
    actorRole: Role,
  ) {
    // Defence in depth. `ASSIGNABLE_ROLES` in user.dto.ts already rejects this
    // at validation, and that is the primary control, but a privilege boundary
    // this important must not rest on a single decorator someone could relax
    // without realising what it was holding up. SYSTEM_ADMIN is a single
    // account bootstrapped on first boot and is never assignable through the API.
    if (dto.role === Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'The system admin role cannot be assigned through the API',
      );
    }
    if (dto.role === Role.ADMIN && actorRole !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only the system admin can invite an ADMIN user',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // A password nobody is told. better-auth needs one to create a credential
    // account; the invited person gets a set-password link instead.
    await auth.api.signUpEmail({
      body: {
        email: dto.email,
        password: generateUnusedPassword(),
        name: dto.name,
      },
    });

    const user = await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        role: dto.role,
        status: 'INVITED',
        mustResetPassword: true,
        createdById: invitedById,
        // better-auth's sign-up wrote `name`; it knows nothing about the two
        // halves. Splitting here means an invited person opens the account
        // screen with their name already in the right two boxes.
        ...splitName(dto.name),
      },
    });

    await this.profiles.createForRole(user.id, user.role);
    await this.auditLog.log({
      userId: invitedById,
      action: 'user.invited',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: dto.email, role: dto.role },
    });
    // Mints the one time token and sends the invite email. No `headers` is
    // passed on purpose: better-auth's `sendResetPassword` hook treats a reset
    // with no originating HTTP request as an invite and sends the invite copy
    // rather than the forgot-password copy.
    await auth.api.requestPasswordReset({ body: { email: dto.email } });

    return toUserResponse(user);
  }
}
