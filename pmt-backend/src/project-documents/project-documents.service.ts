import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  ProjectDocumentType,
  ProjectRole,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination.util';
import { CloudinaryService } from '@/uploads/cloudinary.service';
import { ProjectActivityService } from '@/projects/project-activity.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateProjectDocumentDto } from '@/project-documents/dto/create-project-document.dto';
import { CreateProjectDocumentsBatchDto } from '@/project-documents/dto/create-project-documents-batch.dto';
import { UpdateProjectDocumentDto } from '@/project-documents/dto/update-project-document.dto';
import { QueryProjectDocumentsDto } from '@/project-documents/dto/query-project-documents.dto';

const DOCUMENT_FOLDER = 'pmt/project-documents';

// Matches the maxCount passed to FilesInterceptor in the controller. Kept
// here too since the service is what actually enforces "at least one."
export const MAX_BATCH_UPLOAD_FILES = 10;

const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, email: true } },
};

// A Client never sees a PRD, Requirement, Meeting Note, Credential, or
// internal Asset. They only see Deliverable type documents, e.g. a live
// site link or a Figma link.
const CLIENT_VISIBLE_TYPES: ProjectDocumentType[] = [
  ProjectDocumentType.DELIVERABLE,
];

@Injectable()
export class ProjectDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly projectActivity: ProjectActivityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    projectId: string,
    query: QueryProjectDocumentsDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const { page = 1, pageSize = 20, type, includeHistory = false } = query;
    const where = {
      projectId,
      deletedAt: null,
      ...(actorRole === Role.CLIENT
        ? { type: { in: CLIENT_VISIBLE_TYPES } }
        : type && { type }),
    };

    if (includeHistory) {
      return paginate(
        (args) =>
          this.prisma.projectDocument.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: DOCUMENT_INCLUDE,
            ...args,
          }),
        () => this.prisma.projectDocument.count({ where }),
        page,
        pageSize,
      );
    }

    return this.findLatestPerGroup(where, page, pageSize);
  }

  // Off by default (includeHistory=false): one row per (type, title) group,
  // the newest createdAt in that group, so reuploading a document under the
  // same title stops the older ones from cluttering the list. Grouping is a
  // plain convention, not enforced anywhere on write, a different title just
  // stays its own separate current document, as it always has.
  private async findLatestPerGroup(
    where: Record<string, unknown>,
    page: number,
    pageSize: number,
  ) {
    // Postgres DISTINCT ON via Prisma's `distinct`, which requires orderBy
    // to lead with the distinct fields, then breaks ties by createdAt desc
    // to pick the newest row per group.
    const latestPerGroup = await this.prisma.projectDocument.findMany({
      where,
      distinct: ['type', 'title'],
      orderBy: [{ type: 'asc' }, { title: 'asc' }, { createdAt: 'desc' }],
      include: DOCUMENT_INCLUDE,
    });

    // Re-sort for display (the distinct-driven orderBy above groups by
    // type/title, not by recency) and paginate in application code, since
    // Prisma's count() has no distinct-aware equivalent to pair with this.
    // Fine at this app's actual scale, a project's document count is small.
    const sorted = latestPerGroup.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const total = sorted.length;
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  async findOne(
    projectId: string,
    documentId: string,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    const document = await this.getDocumentOrThrow(projectId, documentId);
    if (
      actorRole === Role.CLIENT &&
      !CLIENT_VISIBLE_TYPES.includes(document.type)
    ) {
      throw new NotFoundException('Document not found');
    }

    const current = await this.prisma.projectDocument.findFirst({
      where: {
        projectId,
        type: document.type,
        title: document.title,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...document,
      supersededBy:
        current && current.id !== document.id
          ? {
              id: current.id,
              title: current.title,
              createdAt: current.createdAt,
            }
          : null,
    };
  }

  async create(
    projectId: string,
    dto: CreateProjectDocumentDto,
    file: Express.Multer.File | undefined,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    if (file && dto.textContent) {
      throw new BadRequestException(
        'A document is either an uploaded file or typed text, not both',
      );
    }
    if (!file && !dto.textContent) {
      throw new BadRequestException(
        'Provide either a file upload or textContent',
      );
    }

    const document = file
      ? await this.createFileDocument(projectId, dto, file, actorId)
      : await this.prisma.projectDocument.create({
          data: {
            projectId,
            title: dto.title,
            description: dto.description,
            type: dto.type,
            format: 'TEXT',
            textContent: dto.textContent,
            uploadedById: actorId,
          },
          include: DOCUMENT_INCLUDE,
        });

    await this.projectActivity.log(projectId, actorId, 'DOCUMENT_ADDED', {
      message: `Document "${document.title}" added`,
      metadata: { documentId: document.id, type: document.type },
    });

    await this.notifyDocumentUploaded(
      projectId,
      actorId,
      `A new document, "${document.title}", was uploaded.`,
    );

    return document;
  }

  private createFileDocument(
    projectId: string,
    dto: CreateProjectDocumentDto,
    file: Express.Multer.File,
    actorId: string,
  ) {
    return this.cloudinary
      .upload(
        file.buffer,
        DOCUMENT_FOLDER,
        file.mimetype.startsWith('image/') ? 'image' : 'raw',
      )
      .then(({ url }) =>
        this.prisma.projectDocument.create({
          data: {
            projectId,
            title: dto.title,
            description: dto.description,
            type: dto.type,
            format: 'FILE',
            fileUrl: url,
            fileMimeType: file.mimetype,
            fileSizeBytes: file.size,
            uploadedById: actorId,
          },
          include: DOCUMENT_INCLUDE,
        }),
      );
  }

  // Every file shares the same type/description and becomes its own
  // ProjectDocument row, titled after its original filename. This suits a
  // Deliverable made up of several files, or a batch of Requirement docs.
  // Files are uploaded one at a time, not in parallel, so the resulting
  // activity log reads in the same order the files were sent.
  async createBatch(
    projectId: string,
    dto: CreateProjectDocumentsBatchDto,
    files: Express.Multer.File[] | undefined,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const documents: Awaited<ReturnType<typeof this.createFileDocument>>[] = [];
    for (const file of files) {
      const document = await this.createFileDocument(
        projectId,
        {
          title: file.originalname,
          type: dto.type,
          description: dto.description,
        },
        file,
        actorId,
      );

      await this.projectActivity.log(projectId, actorId, 'DOCUMENT_ADDED', {
        message: `Document "${document.title}" added`,
        metadata: { documentId: document.id, type: document.type },
      });

      documents.push(document);
    }

    // One notification for the whole batch, not one per file, a 10 file
    // batch upload should not flood the recipient's list.
    await this.notifyDocumentUploaded(
      projectId,
      actorId,
      documents.length === 1
        ? `A new document, "${documents[0].title}", was uploaded.`
        : `${documents.length} new documents were uploaded.`,
    );

    return documents;
  }

  private async notifyDocumentUploaded(
    projectId: string,
    actorId: string,
    message: string,
  ): Promise<void> {
    const recipientIds =
      await this.notificationsService.resolveAllActiveMembersAndAdminIds(
        projectId,
      );
    await Promise.all(
      recipientIds
        .filter((recipientId) => recipientId !== actorId)
        .map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: NotificationType.DOCUMENT_UPLOADED,
            title: 'New document uploaded',
            message,
            metadata: { projectId },
          }),
        ),
    );
  }

  async update(
    projectId: string,
    documentId: string,
    dto: UpdateProjectDocumentDto,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getDocumentOrThrow(projectId, documentId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    if (dto.textContent !== undefined && existing.format !== 'TEXT') {
      throw new BadRequestException(
        'textContent only applies to a TEXT-format document',
      );
    }

    const data: {
      title?: string;
      description?: string;
      textContent?: string;
    } = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.textContent !== undefined) data.textContent = dto.textContent;

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const updated = await this.prisma.projectDocument.update({
      where: { id: documentId },
      data,
      include: DOCUMENT_INCLUDE,
    });

    await this.projectActivity.log(projectId, actorId, 'DOCUMENT_UPDATED', {
      message: `Document "${updated.title}" updated`,
      metadata: { documentId, changes: data },
    });

    return updated;
  }

  async remove(
    projectId: string,
    documentId: string,
    actorId: string,
    actorRole: Role,
  ) {
    const existing = await this.getDocumentOrThrow(projectId, documentId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    await this.prisma.projectDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    await this.projectActivity.log(projectId, actorId, 'DOCUMENT_REMOVED', {
      message: `Document "${existing.title}" removed`,
      metadata: { documentId, type: existing.type },
    });

    return { id: documentId, removed: true };
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async getDocumentOrThrow(projectId: string, documentId: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId, deletedAt: null },
      include: DOCUMENT_INCLUDE,
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  // CLIENT can only see DELIVERABLE type documents, but that check happens
  // above, not here.
  private async assertCanRead(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.CLIENT) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, clientId: actorId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }
      return;
    }
    if (actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: actorId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }

  private async assertManagesProject(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: actorId,
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not manage this project');
    }
  }
}
