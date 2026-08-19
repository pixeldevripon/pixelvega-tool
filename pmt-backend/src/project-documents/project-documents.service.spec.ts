/**
 * Unit tests for project document access and revision grouping.
 *
 * PrismaService and every collaborator are mocked. No database connection.
 *
 * The rule with the sharpest edge: a CLIENT sees DELIVERABLE documents and
 * nothing else. PRDs, requirements, meeting notes, credentials and internal
 * assets must never reach them, and that is enforced by one `where` clause.
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectDocumentType, Role } from '@prisma/client';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/project-activity/project-activity.service';
import { ProjectScopeService } from '@/project-scope/project-scope.service';
import { ProjectDocumentsService } from './project-documents.service';

const PROJECT_ID = 'project-1';
const CLIENT_ID = 'client-1';
const DEV_ID = 'dev-1';
const PM_ID = 'pm-1';

describe('ProjectDocumentsService', () => {
  let service: ProjectDocumentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: PROJECT_ID,
          clientId: CLIENT_ID,
          slackChannelId: null,
        }),
        // The CLIENT scope check re-queries with clientId in the where clause.
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: PROJECT_ID, clientId: CLIENT_ID }),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'doc-1', ...data }),
          ),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        ProjectDocumentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CloudinaryService,
          useValue: { upload: jest.fn(), delete: jest.fn() },
        },
        { provide: ProjectActivityService, useValue: { log: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            resolveAllActiveMembersAndAdminIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(ProjectDocumentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('a CLIENT sees DELIVERABLE documents only', () => {
    it('forces the type filter to DELIVERABLE for a CLIENT', async () => {
      await service.findAll(PROJECT_ID, {}, CLIENT_ID, Role.CLIENT);
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.where.type).toEqual({
        in: [ProjectDocumentType.DELIVERABLE],
      });
    });

    it('IGNORES a client supplied type filter rather than honouring it', async () => {
      // A client asking for CREDENTIAL documents must not get them. The filter
      // is overridden, not merged.
      await service.findAll(
        PROJECT_ID,
        { type: ProjectDocumentType.CREDENTIAL },
        CLIENT_ID,
        Role.CLIENT,
      );
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.where.type).toEqual({
        in: [ProjectDocumentType.DELIVERABLE],
      });
    });

    it('honours a type filter for internal staff', async () => {
      await service.findAll(
        PROJECT_ID,
        { type: ProjectDocumentType.CREDENTIAL },
        PM_ID,
        Role.PROJECT_MANAGER,
      );
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.where.type).toBe(ProjectDocumentType.CREDENTIAL);
    });

    it('rejects a CLIENT reading a project that is not theirs, with 404 not 403', async () => {
      // 404 rather than 403 on purpose: a client who is not this project's
      // client should not learn that it exists at all. Answering 403 would
      // confirm the id is real.
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.findAll(PROJECT_ID, {}, CLIENT_ID, Role.CLIENT),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('soft deleted documents', () => {
    it('are excluded from every list query', async () => {
      await service.findAll(PROJECT_ID, {}, PM_ID, Role.PROJECT_MANAGER);
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBeNull();
    });
  });

  describe('revision grouping', () => {
    it('returns one row per (type, title) group by default', async () => {
      await service.findAll(PROJECT_ID, {}, PM_ID, Role.PROJECT_MANAGER);
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.distinct).toEqual(expect.arrayContaining(['type', 'title']));
    });

    it('returns every revision flat when includeHistory is true', async () => {
      await service.findAll(
        PROJECT_ID,
        { includeHistory: true },
        PM_ID,
        Role.PROJECT_MANAGER,
      );
      const call = prisma.projectDocument.findMany.mock.calls[0][0];
      expect(call.distinct).toBeUndefined();
    });
  });

  describe('a document is either a FILE or TEXT, never both', () => {
    it('rejects a create that supplies neither', async () => {
      await expect(
        service.create(
          PROJECT_ID,
          { type: ProjectDocumentType.PRD, title: 'Spec' },
          undefined,
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('developer access', () => {
    it('rejects a DEVELOPER who is not an active member', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.findAll(PROJECT_ID, {}, DEV_ID, Role.DEVELOPER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a staffed DEVELOPER', async () => {
      await expect(
        service.findAll(PROJECT_ID, {}, DEV_ID, Role.DEVELOPER),
      ).resolves.toBeDefined();
    });

    it('does not require membership of a PROJECT_MANAGER', async () => {
      prisma.projectMember.findFirst.mockResolvedValue(null);
      await expect(
        service.findAll(PROJECT_ID, {}, PM_ID, Role.PROJECT_MANAGER),
      ).resolves.toBeDefined();
    });
  });
});
