import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { documentUploadOptions } from '@/uploads/document-upload.options';
import {
  MAX_BATCH_UPLOAD_FILES,
  ProjectDocumentsService,
} from './project-documents.service';
import { CreateProjectDocumentDto } from '@/project-documents/dto/create-project-document.dto';
import { CreateProjectDocumentsBatchDto } from '@/project-documents/dto/create-project-documents-batch.dto';
import { UpdateProjectDocumentDto } from '@/project-documents/dto/update-project-document.dto';
import { QueryProjectDocumentsDto } from '@/project-documents/dto/query-project-documents.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

// Only Admin/System Admin/Project Manager ever upload, type, edit, or delete
// a project document. Developer/Designer/Client are read only here. A
// PROJECT_MANAGER caller must additionally be actively staffed as PM on
// this specific project.

@ApiTags('Project Documents')
@ApiCookieAuth('better-auth.session_token')
@Controller('projects/:projectId/documents')
export class ProjectDocumentsController {
  constructor(
    private readonly projectDocumentsService: ProjectDocumentsService,
  ) {}

  @ApiOperation({
    summary: "List a project's documents",
    description:
      'PROJECT_MANAGER/ADMIN/SYSTEM_ADMIN see every document type. DEVELOPER/DESIGNER must be an active ProjectMember. CLIENT is restricted to DELIVERABLE-type documents on their own project only (the type filter is ignored for CLIENT). By default only the newest document per (type, title) group is returned, pass includeHistory=true to see every superseded revision too.',
  })
  @ApiResponse({ status: 200, description: 'Paginated project documents' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.VIEW_PROJECT_DOCUMENTS)
  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryProjectDocumentsDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.findAll(
      projectId,
      query,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Get a single project document',
    description:
      'Content is unchanged even if a newer revision exists under the same (type, title): the response includes supersededBy (id/title/createdAt of the current document in that group, or null if this is already the current one) so a stale link is at least flagged rather than silently served with no signal.',
  })
  @ApiResponse({ status: 200, description: 'The document' })
  @ApiResponse({ status: 404, description: 'Project or document not found' })
  @RequirePermissions(Permission.VIEW_PROJECT_DOCUMENTS)
  @Get(':id')
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.findOne(
      projectId,
      id,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Add a project document',
    description:
      'multipart/form-data. Send a "file" field to create a FILE-format document, or omit it and send textContent to create a TEXT-format one (e.g. a Credential). Admin/System Admin/Project Manager only — a PROJECT_MANAGER caller must be actively staffed as PM on this specific project.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        textContent: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document created' })
  @ApiResponse({
    status: 400,
    description: 'Neither a file nor textContent provided, or both were',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.MANAGE_PROJECT_DOCUMENTS)
  @Post()
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.create(
      projectId,
      dto,
      file,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Add multiple project documents in one request',
    description: `multipart/form-data with one or more "files" fields (max ${MAX_BATCH_UPLOAD_FILES}), all sharing the same type/description — each file becomes its own ProjectDocument row, titled after its original filename. For a distinct title per file, or a TEXT-format document, use POST /documents instead. Admin/System Admin/Project Manager only — a PROJECT_MANAGER caller must be actively staffed as PM on this specific project.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        description: { type: 'string' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Documents created' })
  @ApiResponse({ status: 400, description: 'No files provided' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @RequirePermissions(Permission.MANAGE_PROJECT_DOCUMENTS)
  @Post('batch')
  @UseInterceptors(
    FilesInterceptor('files', MAX_BATCH_UPLOAD_FILES, documentUploadOptions),
  )
  createBatch(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectDocumentsBatchDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.createBatch(
      projectId,
      dto,
      files,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Edit a project document',
    description:
      "Metadata only (title/description/textContent) — a FILE document's underlying upload cannot be replaced this way. Admin/System Admin/Project Manager only — a PROJECT_MANAGER caller must be actively staffed as PM on this specific project.",
  })
  @ApiResponse({ status: 200, description: 'Document updated' })
  @ApiResponse({
    status: 400,
    description: 'textContent sent for a FILE-format document',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project or document not found' })
  @RequirePermissions(Permission.MANAGE_PROJECT_DOCUMENTS)
  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDocumentDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.update(
      projectId,
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @ApiOperation({
    summary: 'Delete a project document',
    description:
      'Soft delete (sets deletedAt) — history is preserved, same pattern as User. Admin/System Admin/Project Manager only — a PROJECT_MANAGER caller must be actively staffed as PM on this specific project.',
  })
  @ApiResponse({ status: 200, description: 'Document removed' })
  @ApiResponse({
    status: 403,
    description: 'Caller is not staffed as PM on this project',
  })
  @ApiResponse({ status: 404, description: 'Project or document not found' })
  @RequirePermissions(Permission.MANAGE_PROJECT_DOCUMENTS)
  @Delete(':id')
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.projectDocumentsService.remove(
      projectId,
      id,
      user.id,
      user.role,
    );
  }
}
