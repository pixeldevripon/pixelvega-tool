import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityStatus,
  EmployeeWorkStatus,
  Gender,
  Role,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { PASSWORD_MIN_LENGTH } from '@/common/constants/password-policy';

import { ProfilesService } from '../profiles.service';

describe('ProfilesService', () => {
  let service: ProfilesService;

  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    account: { findMany: jest.fn() },
    session: { deleteMany: jest.fn() },
    clientProfile: { update: jest.fn(), create: jest.fn() },
    employeeProfile: { update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const cloudinary = { upload: jest.fn(), delete: jest.fn() };
  const auditLog = { log: jest.fn() };

  const PROFILE = {
    id: 'u1',
    email: 'dev@pixelvega.com',
    name: 'Rezina Akter',
    firstName: 'Rezina',
    lastName: 'Akter',
    country: 'BD',
    gender: null,
    socialUrls: [],
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
    slackUserId: null,
    employeeProfile: {
      phone: null,
      currentStatus: EmployeeWorkStatus.WORKING,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
    },
  };

  /** What `updateUserFields` reads before writing. */
  const EXISTING_USER_FIELDS = {
    name: 'Rezina Akter',
    firstName: 'Rezina',
    lastName: 'Akter',
    country: 'BD',
    gender: null,
    socialUrls: [],
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
    prisma.user.findUniqueOrThrow.mockResolvedValue(EXISTING_USER_FIELDS);
    prisma.account.findMany.mockResolvedValue([]);
  });

  describe('getOptions', () => {
    it('serves the country list so no client ships one', () => {
      const { countries } = service.getOptions();
      expect(countries.length).toBeGreaterThan(200);
      expect(countries).toContainEqual({ value: 'BD', label: 'Bangladesh' });
    });

    it('sorts countries by label, because sorting in a browser is what D4 forbids', () => {
      const labels = service.getOptions().countries.map((c) => c.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    });

    it('serves every gender as a display object', () => {
      expect(service.getOptions().genders).toContainEqual({
        value: 'PREFER_NOT_TO_SAY',
        label: 'Prefer not to say',
        tone: 'default',
      });
    });

    it('serves the password policy the server actually enforces', () => {
      const { password } = service.getOptions();
      expect(password.minLength).toBe(PASSWORD_MIN_LENGTH);
      expect(password.rules.map((rule) => rule.key)).toEqual([
        'MIN_LENGTH',
        'LOWERCASE',
        'UPPERCASE',
        'NUMBER',
        'SPECIAL',
      ]);
    });

    it('gives each rule a pattern a client can evaluate while someone types', () => {
      const uppercase = service
        .getOptions()
        .password.rules.find((rule) => rule.key === 'UPPERCASE')!;
      expect(new RegExp(uppercase.pattern).test('abc')).toBe(false);
      expect(new RegExp(uppercase.pattern).test('aBc')).toBe(true);
    });

    it('serves the avatar cap from the same constant multer enforces', () => {
      expect(service.getOptions().avatarMaxSizeMb).toBe(5);
    });
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

    it('never selects a token or a password hash off the Account table', async () => {
      await service.findOwnProfile('u1');
      const [args] = prisma.account.findMany.mock.calls[0] as [
        { select: Record<string, boolean> },
      ];
      expect(Object.keys(args.select).sort()).toEqual([
        'accountId',
        'createdAt',
        'providerId',
      ]);
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

    it('recomposes the full name from the two halves', async () => {
      await service.update('u1', Role.DEVELOPER, { firstName: 'Rezina A.' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { firstName: 'Rezina A.', name: 'Rezina A. Akter' },
      });
    });

    it('composes from the stored half when only one is supplied', async () => {
      await service.update('u1', Role.DEVELOPER, { lastName: 'Khatun' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastName: 'Khatun', name: 'Rezina Khatun' },
      });
    });

    it('leaves the name alone when both halves are cleared', async () => {
      // `User.name` is NOT NULL and a person with no name is a row nothing can
      // render, so clearing both fields must not blank it.
      await service.update('u1', Role.DEVELOPER, {
        firstName: '',
        lastName: '',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { firstName: null, lastName: null },
      });
    });

    it('clears the country on the documented empty string', async () => {
      await service.update('u1', Role.DEVELOPER, { country: '' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { country: null },
      });
    });

    it('replaces the whole social URL list rather than appending', async () => {
      await service.update('u1', Role.DEVELOPER, {
        socialUrls: ['https://github.com/rezina'],
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { socialUrls: ['https://github.com/rezina'] },
      });
    });

    it('writes the gender through unchanged', async () => {
      await service.update('u1', Role.DEVELOPER, { gender: Gender.FEMALE });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { gender: Gender.FEMALE },
      });
    });

    it('does not touch the user row when no User field was supplied', async () => {
      await service.update('u1', Role.DEVELOPER, { bio: 'Hello' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('records what actually changed on the user row', async () => {
      await service.update('u1', Role.DEVELOPER, { country: 'US' });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.updated',
          // Both sides. An entry saying `{ country: 'US' }` records that
          // something changed without recording what it was.
          metadata: { changes: { country: { from: 'BD', to: 'US' } } },
        }),
      );
    });

    it('writes no user audit entry when the value is unchanged', async () => {
      await service.update('u1', Role.DEVELOPER, { country: 'BD' });
      expect(auditLog.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.updated' }),
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
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'u1', avatarPublicId: 'old-id' })
        .mockResolvedValue(PROFILE);
      cloudinary.upload.mockResolvedValue({
        url: 'https://x/new',
        publicId: 'new-id',
      });
      cloudinary.delete.mockResolvedValue(undefined);
      await service.updateAvatar('u1', file);
      expect(cloudinary.delete).toHaveBeenCalledWith('old-id', 'image');
    });

    it('does not attempt a delete on a first upload', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'u1', avatarPublicId: null })
        .mockResolvedValue(PROFILE);
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
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'u1', avatarPublicId: 'old-id' })
        .mockResolvedValue(PROFILE);
      cloudinary.upload.mockResolvedValue({
        url: 'https://x/new',
        publicId: 'new-id',
      });
      cloudinary.delete.mockRejectedValue(new Error('cloudinary is down'));
      await expect(service.updateAvatar('u1', file)).resolves.toBeDefined();
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('removeAvatar', () => {
    it('destroys the stored asset and clears both columns', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'u1',
          avatarPublicId: 'old-id',
          avatarUrl: 'https://x/old',
        })
        .mockResolvedValue(PROFILE);
      cloudinary.delete.mockResolvedValue(undefined);

      await service.removeAvatar('u1');

      expect(cloudinary.delete).toHaveBeenCalledWith('old-id', 'image');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        // Both, not just the URL: leaving the public id behind orphans the
        // asset forever, because a URL cannot destroy one.
        data: { avatarUrl: null, avatarPublicId: null },
      });
    });

    it('is a no-op on Cloudinary when there was no avatar', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'u1',
          avatarPublicId: null,
          avatarUrl: null,
        })
        .mockResolvedValue(PROFILE);
      await service.removeAvatar('u1');
      expect(cloudinary.delete).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('refuses the credential provider, which is the only way in', async () => {
      await expect(service.disconnect('u1', 'credential')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses a provider it has never heard of', async () => {
      await expect(service.disconnect('u1', 'github')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('clears the cached Slack member id', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ slackUserId: 'U08ABCDEF' })
        .mockResolvedValue(PROFILE);
      await service.disconnect('u1', 'slack');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { slackUserId: null },
      });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'profile.connection_removed',
          metadata: { provider: 'SLACK' },
        }),
      );
    });

    it('404s when Slack was never connected', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ slackUserId: null });
      await expect(service.disconnect('u1', 'SLACK')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteOwnAccount', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'dev@pixelvega.com',
      });
      prisma.$transaction.mockResolvedValue([]);
    });

    it('refuses the SYSTEM_ADMIN, because there must always be a root account', async () => {
      await expect(
        service.deleteOwnAccount('root', Role.SYSTEM_ADMIN, 'root@x.com'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a confirmation that does not match the account', async () => {
      await expect(
        service.deleteOwnAccount('u1', Role.DEVELOPER, 'someone@else.com'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('accepts a differently cased confirmation, because an email is case insensitive', async () => {
      await expect(
        service.deleteOwnAccount('u1', Role.DEVELOPER, 'Dev@PixelVega.com'),
      ).resolves.toEqual({ message: 'Account deleted.' });
    });

    it('soft deletes and destroys every session in one transaction', async () => {
      await service.deleteOwnAccount('u1', Role.DEVELOPER, 'dev@pixelvega.com');

      // One transaction, not two writes: otherwise there is a window where the
      // account is gone and a live cookie is still being accepted.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    it('records the deletion as self service, so the log says who did it', async () => {
      await service.deleteOwnAccount('u1', Role.DEVELOPER, 'dev@pixelvega.com');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.deleted',
          targetId: 'u1',
          metadata: { selfService: true },
        }),
      );
    });

    it('404s for an account that is already gone', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteOwnAccount('u1', Role.DEVELOPER, 'dev@pixelvega.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
