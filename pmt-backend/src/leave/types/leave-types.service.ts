import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/audit-log/audit-log.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from '@/leave/dto/leave.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    return leaveType;
  }

  async create(dto: CreateLeaveTypeDto, actorId: string) {
    const leaveType = await this.prisma.leaveType.create({ data: dto });

    await this.auditLog.log({
      userId: actorId,
      action: 'leave_type.created',
      targetType: 'LeaveType',
      targetId: leaveType.id,
      metadata: { name: leaveType.name },
    });

    return leaveType;
  }

  async update(id: string, dto: UpdateLeaveTypeDto, actorId: string) {
    await this.findOne(id);
    const leaveType = await this.prisma.leaveType.update({
      where: { id },
      data: dto,
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'leave_type.updated',
      targetType: 'LeaveType',
      targetId: id,
      metadata: { ...dto },
    });

    return leaveType;
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.leaveType.delete({ where: { id } });

    await this.auditLog.log({
      userId: actorId,
      action: 'leave_type.deleted',
      targetType: 'LeaveType',
      targetId: id,
    });

    return { message: 'Leave type deleted.' };
  }
}
