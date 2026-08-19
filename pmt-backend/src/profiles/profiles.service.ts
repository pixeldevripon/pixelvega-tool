import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { AuditLogService } from '@/audit-log/audit-log.service';
import { UpdateProfileRequestDto } from '@/profiles/dto/profile.dto';
import { toProfileResponse } from '@/profiles/profile.mapper';

const USER_WITH_PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  employeeProfile: true,
  clientProfile: true,
};

function isClientRole(role: Role) {
  return role === Role.CLIENT;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findByUserId(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: USER_WITH_PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(user);
  }

  async update(userId: string, role: Role, dto: UpdateProfileRequestDto) {
    const { name, ...profileFields } = dto;

    if (name !== undefined) {
      const existingUser = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true },
      });
      if (name !== existingUser.name) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { name },
        });
        await this.auditLog.log({
          userId,
          action: 'user.updated',
          targetType: 'User',
          targetId: userId,
          metadata: {
            changes: { name: { from: existingUser.name, to: name } },
          },
        });
      }
    }

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

    return this.findByUserId(userId);
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, avatarPublicId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { url, publicId } = await this.cloudinary.upload(
      file.buffer,
      'pmt/avatars',
      'image',
    );

    if (user.avatarPublicId) {
      await this.cloudinary
        .delete(user.avatarPublicId, 'image')
        .catch(() => undefined);
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

    return this.findByUserId(userId);
  }

  // Called by UsersService right after a User row is created (invite flow).
  createForRole(userId: string, role: Role) {
    if (isClientRole(role)) {
      return this.prisma.clientProfile.create({ data: { userId } });
    }
    return this.prisma.employeeProfile.create({ data: { userId } });
  }
}
