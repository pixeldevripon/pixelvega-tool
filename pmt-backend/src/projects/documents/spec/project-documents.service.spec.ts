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
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import { ProjectDocumentsService } from '../project-documents.service';

const PROJECT_ID = 'project-1';
const CLIENT_ID = 'client-1';
const DEV_ID = 'dev-1';
const PM_ID = 'pm-1';

describe('ProjectDocumentsService', () => {
  let service: ProjectDocumentsService;
  let prisma: any;
  let projectActivity: { log: jest.Mock };
  let cloudinary: {
    upload: jest.Mock;
    uploadMany: jest.Mock;
    delete: jest.Mock;
    deleteUnknownResourceType: jest.Mock;
  };

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
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'doc-1',
            ...data,
            // The mapper reads the relations DOCUMENT_INCLUDE brings in, so a
            // mock that returns only `data` throws inside the mapper rather
            // than failing the assertion under test.
            uploadedBy: { id: PM_ID, name: 'Priya', email: 'pm@pixelvega.com' },
            supersededBy: null,
          }),
        ),
        update: jest.fn(),
      },
    };

    // `$transaction(fn)` hands the callback a client. Passing `prisma` itself
    // is what makes the transactional writes observable on the same mocks the
    // non-transactional ones use.
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));

    projectActivity = { log: jest.fn() };

    cloudinary = {
      upload: jest.fn(),
      uploadMany: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteUnknownResourceType: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectScopeService,
        ProjectDocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: ProjectActivityService, useValue: projectActivity },
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

  describe('removing a document deletes its Cloudinary asset', () => {
    const DOC = {
      id: 'doc-1',
      projectId: PROJECT_ID,
      title: 'Acme PRD',
      type: 'PRD',
      format: 'FILE',
      deletedAt: null,
      filePublicId: 'pmt/project-documents/acme-prd',
      fileResourceType: 'raw',
    };

    beforeEach(() => {
      prisma.projectDocument.findFirst.mockResolvedValue(DOC);
      prisma.projectDocument.update.mockResolvedValue({
        ...DOC,
        deletedAt: new Date(),
      });
    });

    it('destroys the asset using its OWN resource type', async () => {
      // Cloudinary partitions its namespace by resource type: destroying a raw
      // file as an 'image' silently succeeds and deletes nothing.
      await service.remove(PROJECT_ID, 'doc-1', 'pm-1', Role.PROJECT_MANAGER);
      expect(cloudinary.delete).toHaveBeenCalledWith(
        'pmt/project-documents/acme-prd',
        'raw',
      );
    });

    it('soft deletes the row, so history and the audit trail survive', async () => {
      await service.remove(PROJECT_ID, 'doc-1', 'pm-1', Role.PROJECT_MANAGER);
      const call = prisma.projectDocument.update.mock.calls[0][0];
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });

    it('does not call Cloudinary for a TEXT document, which has no asset', async () => {
      prisma.projectDocument.findFirst.mockResolvedValue({
        ...DOC,
        format: 'TEXT',
        filePublicId: null,
        fileResourceType: null,
      });
      await service.remove(PROJECT_ID, 'doc-1', 'pm-1', Role.PROJECT_MANAGER);
      expect(cloudinary.delete).not.toHaveBeenCalled();
    });

    it('still removes the document when Cloudinary is down', async () => {
      // Best effort on purpose: an outage must not fail a removal the user
      // already asked for. The orphaned asset is logged instead.
      cloudinary.delete.mockRejectedValue(new Error('cloudinary is down'));
      await expect(
        service.remove(PROJECT_ID, 'doc-1', 'pm-1', Role.PROJECT_MANAGER),
      ).resolves.toEqual({ id: 'doc-1', removed: true });
      expect(prisma.projectDocument.update).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Uploads
  // ══════════════════════════════════════════════════════════════════════════

  function asset(publicId: string, resourceType = 'image') {
    return {
      url: `https://res.cloudinary.com/${publicId}`,
      publicId,
      resourceType,
      bytes: 1_024,
      originalFilename: publicId,
    };
  }

  function file(name: string, mimetype = 'application/pdf') {
    return {
      originalname: name,
      mimetype,
      buffer: Buffer.from(name),
    } as Express.Multer.File;
  }

  describe('create with a file', () => {
    it('never passes a resourceType, so Cloudinary decides from the bytes', async () => {
      // Guessing from the mimetype (`startsWith('image/') ? 'image' : 'raw'`)
      // stored a video as an undeliverable raw blob.
      cloudinary.upload.mockResolvedValue(asset('spec.pdf', 'raw'));

      await service.create(
        PROJECT_ID,
        {
          title: 'Spec',
          type: ProjectDocumentType.REQUIREMENT,
          format: 'FILE',
        } as any,
        file('spec.pdf'),
        PM_ID,
        Role.PROJECT_MANAGER,
      );

      const [, options] = cloudinary.upload.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(options).not.toHaveProperty('resourceType');
    });

    it('stores the publicId AND the resourceType, or the asset can never be deleted', async () => {
      cloudinary.upload.mockResolvedValue(asset('spec.pdf', 'raw'));

      await service.create(
        PROJECT_ID,
        {
          title: 'Spec',
          type: ProjectDocumentType.REQUIREMENT,
          format: 'FILE',
        } as any,
        file('spec.pdf'),
        PM_ID,
        Role.PROJECT_MANAGER,
      );

      const { data } = prisma.projectDocument.create.mock.calls[0][0];
      expect(data.filePublicId).toBe('spec.pdf');
      // Cloudinary partitions its namespace by resource type: without this,
      // deleting the document later removes nothing.
      expect(data.fileResourceType).toBe('raw');
      expect(data.fileSizeBytes).toBe(1_024);
    });

    it('deletes the asset when the row fails to write', async () => {
      // Otherwise the bytes are in Cloudinary with nothing referencing them:
      // billed for, and impossible to find again.
      cloudinary.upload.mockResolvedValue(asset('spec.pdf', 'raw'));
      prisma.projectDocument.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.create(
          PROJECT_ID,
          {
            title: 'Spec',
            type: ProjectDocumentType.REQUIREMENT,
            format: 'FILE',
          } as any,
          file('spec.pdf'),
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).rejects.toThrow('db down');

      expect(cloudinary.delete).toHaveBeenCalledWith('spec.pdf', 'raw');
    });
  });

  describe('createBatch', () => {
    const dto = { type: ProjectDocumentType.DELIVERABLE } as any;

    it('refuses an empty batch', async () => {
      await expect(
        service.createBatch(PROJECT_ID, dto, [], PM_ID, Role.PROJECT_MANAGER),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinary.uploadMany).not.toHaveBeenCalled();
    });

    it('writes every row in ONE transaction', async () => {
      // Row by row, a failure on the third file of ten left eight assets in
      // Cloudinary and two rows in the database: a batch reported as failed,
      // half of which existed.
      cloudinary.uploadMany.mockResolvedValue([
        asset('a.pdf', 'raw'),
        asset('b.png'),
      ]);

      await service.createBatch(
        PROJECT_ID,
        dto,
        [file('a.pdf'), file('b.png', 'image/png')],
        PM_ID,
        Role.PROJECT_MANAGER,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.projectDocument.create).toHaveBeenCalledTimes(2);
    });

    it('pairs each file with ITS OWN asset and mimetype', async () => {
      // The two arrays are zipped by index. Crossing them stores a PDF's bytes
      // under a PNG's mimetype, and the download then serves the wrong type.
      cloudinary.uploadMany.mockResolvedValue([
        asset('a.pdf', 'raw'),
        asset('b.png', 'image'),
      ]);

      await service.createBatch(
        PROJECT_ID,
        dto,
        [file('a.pdf'), file('b.png', 'image/png')],
        PM_ID,
        Role.PROJECT_MANAGER,
      );

      const rows = prisma.projectDocument.create.mock.calls.map(
        ([{ data }]: any) => ({
          title: data.title,
          mime: data.fileMimeType,
          publicId: data.filePublicId,
          resourceType: data.fileResourceType,
        }),
      );
      expect(rows).toEqual([
        {
          title: 'a.pdf',
          mime: 'application/pdf',
          publicId: 'a.pdf',
          resourceType: 'raw',
        },
        {
          title: 'b.png',
          mime: 'image/png',
          publicId: 'b.png',
          resourceType: 'image',
        },
      ]);
    });

    it('bounds the title, which comes straight from the client', async () => {
      // multer reads `originalname` from the multipart headers, so it is
      // caller-supplied text of any length.
      const longName = 'x'.repeat(500);
      cloudinary.uploadMany.mockResolvedValue([asset('long', 'raw')]);

      await service.createBatch(
        PROJECT_ID,
        dto,
        [file(longName)],
        PM_ID,
        Role.PROJECT_MANAGER,
      );

      const { data } = prisma.projectDocument.create.mock.calls[0][0];
      expect(data.title).toHaveLength(200);
    });

    it('deletes every uploaded asset when the transaction fails', async () => {
      cloudinary.uploadMany.mockResolvedValue([
        asset('a.pdf', 'raw'),
        asset('b.png', 'image'),
      ]);
      prisma.$transaction.mockRejectedValue(new Error('deadlock'));

      await expect(
        service.createBatch(
          PROJECT_ID,
          dto,
          [file('a.pdf'), file('b.png', 'image/png')],
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).rejects.toThrow('deadlock');

      expect(
        cloudinary.delete.mock.calls
          .map(([id, type]) => `${id}:${type}`)
          .sort(),
      ).toEqual(['a.pdf:raw', 'b.png:image']);
    });

    it('logs no activity for a batch that rolled back', async () => {
      // The activity log records things that happened. A rolled back batch
      // did not happen.
      cloudinary.uploadMany.mockResolvedValue([asset('a.pdf', 'raw')]);
      prisma.$transaction.mockRejectedValue(new Error('deadlock'));

      await expect(
        service.createBatch(
          PROJECT_ID,
          dto,
          [file('a.pdf')],
          PM_ID,
          Role.PROJECT_MANAGER,
        ),
      ).rejects.toThrow('deadlock');

      expect(projectActivity.log).not.toHaveBeenCalled();
    });
  });
});
