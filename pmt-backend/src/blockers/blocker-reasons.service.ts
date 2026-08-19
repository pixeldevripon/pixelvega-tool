import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/audit-log/audit-log.service';
import {
  CreateBlockerReasonDto,
  UpdateBlockerReasonDto,
} from '@/blockers/dto/blocker.dto';

// Seeded once as the fallback reason BlockerService.addBlocker() assigns
// when a blocker is reported without an explicit reasonId. Identified by
// name, since that's the only field this model has, rather than a dedicated
// flag column, so it's protected from rename and delete below to keep that
// fallback working.
export const DEFAULT_BLOCKER_REASON_NAME = 'Unspecified';

const DUPLICATE_NAME_ERROR = 'A blocker reason with this name already exists';

@Injectable()
export class BlockerReasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.blockerReason.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const reason = await this.prisma.blockerReason.findFirst({
      where: { id, deletedAt: null },
    });
    if (!reason) {
      throw new NotFoundException('Blocker reason not found');
    }
    return reason;
  }

  async create(dto: CreateBlockerReasonDto, actorId: string) {
    const reason = await this.createOrThrowOnDuplicate(dto);

    await this.auditLog.log({
      userId: actorId,
      action: 'blocker_reason.created',
      targetType: 'BlockerReason',
      targetId: reason.id,
      metadata: { name: reason.name },
    });

    return reason;
  }

  async update(id: string, dto: UpdateBlockerReasonDto, actorId: string) {
    const existing = await this.findOne(id);

    if (
      existing.name === DEFAULT_BLOCKER_REASON_NAME &&
      dto.name !== undefined &&
      dto.name !== DEFAULT_BLOCKER_REASON_NAME
    ) {
      throw new ForbiddenException(
        'The default "Unspecified" reason cannot be renamed',
      );
    }

    const reason = await this.updateOrThrowOnDuplicate(id, dto);

    await this.auditLog.log({
      userId: actorId,
      action: 'blocker_reason.updated',
      targetType: 'BlockerReason',
      targetId: id,
      metadata: { ...dto },
    });

    return reason;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.findOne(id);

    if (existing.name === DEFAULT_BLOCKER_REASON_NAME) {
      throw new ForbiddenException(
        'The default "Unspecified" reason cannot be deleted',
      );
    }

    await this.prisma.blockerReason.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'blocker_reason.deleted',
      targetType: 'BlockerReason',
      targetId: id,
    });

    return { message: 'Blocker reason deleted.' };
  }

  // name uniqueness is enforced by a partial DB index over active rows only,
  // not a Prisma @unique, so a collision surfaces here as a P2002 that gets
  // translated into a clean 409 instead of a raw 500.
  private async createOrThrowOnDuplicate(dto: CreateBlockerReasonDto) {
    try {
      return await this.prisma.blockerReason.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE_NAME_ERROR);
      }
      throw error;
    }
  }

  private async updateOrThrowOnDuplicate(
    id: string,
    dto: UpdateBlockerReasonDto,
  ) {
    try {
      return await this.prisma.blockerReason.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(DUPLICATE_NAME_ERROR);
      }
      throw error;
    }
  }
}
