import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AvailabilityStatus, EmployeeWorkStatus, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { AuditLogService } from '@/audit-log/audit-log.service';

import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  let service: ProfilesService;

  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    clientProfile: { update: jest.fn(), create: jest.fn() },
    employeeProfile: { update: jest.fn(), create: jest.fn() },
  };
  const cloudinary = { upload: jest.fn(), delete: jest.fn() };
  const auditLog = { log: jest.fn() };

  const PROFILE = {
    id: 'u1',
    name: 'Rezina Akter',
    role: Role.DEVELOPER,
    employeeProfile: {
      currentStatus: EmployeeWorkStatus.WORKING,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = moduleRef.get(ProfilesService);
    prisma.user.findFirst.mockResolvedValue(PROFILE);
  });

  describe('findByUserId', () => {
    it('404s rather than returning null, so a caller cannot forget to check', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findByUserId('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('excludes a soft deleted user', async () => {
      await service.findByUserId('u1');
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1', deletedAt: null } }),
      );
    });

    it('returns the statuses as display objects', async () => {
      const result = await service.findByUserId('u1');
      expect(result.role.value).toBe('DEVELOPER');
      expect(result.employeeProfile?.currentStatus.value).toBe('WORKING');
    });
  });

  describe('update', () => {
    it('writes the employee profile for a staff role', async () => {
      await service.update('u1', Role.DEVELOPER, {
        designation: 'Senior Developer',
      });
      expect(prisma.employeeProfile.update).toHaveBeenCalled();
      expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    });

    it('writes the CLIENT profile for a client, and never the employee one', async () => {
      // The two profiles hold different fields. Writing the wrong one would
      // silently drop everything the caller sent.
      await service.update('c1', Role.CLIENT, { companyName: 'Acme Ltd' });
      expect(prisma.clientProfile.update).toHaveBeenCalled();
      expect(prisma.employeeProfile.update).not.toHaveBeenCalled();
    });

    it('does not touch the user row when the name is unchanged', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Rezina Akter' });
      await service.update('u1', Role.DEVELOPER, { name: 'Rezina Akter' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the name and records the before and after when it changes', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Rezina Akter' });
      await service.update('u1', Role.DEVELOPER, { name: 'Rezina A.' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Rezina A.' },
      });
      // The audit entry has to carry both sides, or the log says something
      // changed without saying what it was.
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.updated',
          metadata: {
            changes: { name: { from: 'Rezina Akter', to: 'Rezina A.' } },
          },
        }),
      );
    });

    it('does not write an audit entry when nothing on the profile changed', async () => {
      await service.update('u1', Role.DEVELOPER, {});
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('audits only the fields actually supplied, not every undefined one', async () => {
      await service.update('u1', Role.DEVELOPER, {
        designation: 'Senior Developer',
        bio: undefined,
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'profile.updated',
          targetType: 'EmployeeProfile',
          metadata: { designation: 'Senior Developer' },
        }),
      );
    });

    it('names the right target type for a client', async () => {
      await service.update('c1', Role.CLIENT, { companyName: 'Acme Ltd' });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: 'ClientProfile' }),
      );
    });
  });

  describe('updateAvatar', () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    it('deletes the previous asset when replacing one', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        avatarPublicId: 'old-id',
      });
      cloudinary.upload.mockResolvedValue({
        url: 'https://x/new',
        publicId: 'new-id',
      });
      cloudinary.delete.mockResolvedValue(undefined);
      await service.updateAvatar('u1', file);
      expect(cloudinary.delete).toHaveBeenCalledWith('old-id', 'image');
    });

    it('does not attempt a delete on a first upload', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        avatarPublicId: null,
      });
      cloudinary.upload.mockResolvedValue({
        url: 'https://x/new',
        publicId: 'new-id',
      });
      await service.updateAvatar('u1', file);
      expect(cloudinary.delete).not.toHaveBeenCalled();
    });

    it('still succeeds when deleting the old asset fails', async () => {
      // A failed delete leaves an orphaned file, which is not worth failing
      // the upload over. The service logs it instead.
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        avatarPublicId: 'old-id',
      });
      cloudinary.upload.mockResolvedValue({
        url: 'https://x/new',
        publicId: 'new-id',
      });
      cloudinary.delete.mockRejectedValue(new Error('cloudinary is down'));
      await expect(service.updateAvatar('u1', file)).resolves.toBeDefined();
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
