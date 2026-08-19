import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditLogService } from '@/audit-log/audit-log.service';
import { daysBetweenInclusive } from '@/common/utils/date.util';
import { CreateHolidayDto } from '@/leave/dto/create-holiday.dto';
import { UpdateHolidayDto } from '@/leave/dto/update-holiday.dto';

function withDays<T extends { startDate: Date; endDate: Date }>(holiday: T) {
  return {
    ...holiday,
    days: daysBetweenInclusive(holiday.startDate, holiday.endDate),
  };
}

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const holidays = await this.prisma.holiday.findMany({
      orderBy: { startDate: 'asc' },
    });
    return holidays.map(withDays);
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }
    return holiday;
  }

  async create(dto: CreateHolidayDto, actorId: string) {
    const startDate = new Date(dto.startDate);
    // No endDate means a holiday that spans a single day, defaulting to
    // the same day.
    const endDate = dto.endDate ? new Date(dto.endDate) : startDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    const holiday = await this.prisma.holiday.create({
      data: { name: dto.name, startDate, endDate },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'holiday.created',
      targetType: 'Holiday',
      targetId: holiday.id,
      metadata: {
        name: holiday.name,
        startDate: dto.startDate,
        endDate: dto.endDate ?? dto.startDate,
      },
    });

    return withDays(holiday);
  }

  async update(id: string, dto: UpdateHolidayDto, actorId: string) {
    const existing = await this.findOne(id);
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    const holiday = await this.prisma.holiday.update({
      where: { id },
      data: { name: dto.name, startDate, endDate },
    });

    await this.auditLog.log({
      userId: actorId,
      action: 'holiday.updated',
      targetType: 'Holiday',
      targetId: id,
      metadata: { ...dto },
    });

    return withDays(holiday);
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.holiday.delete({ where: { id } });

    await this.auditLog.log({
      userId: actorId,
      action: 'holiday.deleted',
      targetType: 'Holiday',
      targetId: id,
    });

    return { message: 'Holiday deleted.' };
  }
}
