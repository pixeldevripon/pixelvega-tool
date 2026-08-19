import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LeaveBalancesService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the balance row for this user/leaveType/year the first time
  // it's needed. There's no cron job and nothing carries forward from the
  // previous year.
  async getOrCreate(userId: string, leaveTypeId: string, year: number) {
    const existing = await this.prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    });
    if (existing) {
      return existing;
    }

    const leaveType = await this.prisma.leaveType.findUniqueOrThrow({
      where: { id: leaveTypeId },
    });

    return this.prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId,
        year,
        allocatedDays: leaveType.defaultDaysPerYear,
      },
    });
  }

  async findAllForUser(userId: string, year: number) {
    const leaveTypes = await this.prisma.leaveType.findMany();

    const balances = await Promise.all(
      leaveTypes.map((leaveType) =>
        this.getOrCreate(userId, leaveType.id, year),
      ),
    );

    return balances.map((balance, index) => ({
      leaveType: leaveTypes[index],
      allocatedDays: balance.allocatedDays,
      usedDays: balance.usedDays,
      remainingDays: balance.allocatedDays - balance.usedDays,
    }));
  }

  async incrementUsedDays(
    userId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ) {
    const balance = await this.getOrCreate(userId, leaveTypeId, year);
    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { usedDays: balance.usedDays + days },
    });
  }
}
