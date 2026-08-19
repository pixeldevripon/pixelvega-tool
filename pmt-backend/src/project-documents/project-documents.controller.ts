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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  MAX_BATCH_UPLOAD_FILES,
  documentUploadOptions,
} from '@/uploads/upload-options';
import { ProjectDocumentsService } from './project-documents.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import {
  ApiCreateProjectDocumentDocs,
  ApiCreateProjectDocumentsBatchDocs,
  ApiDeleteProjectDocumentDocs,
  ApiGetProjectDocumentDocs,
  ApiListProjectDocumentsDocs,
  ApiUpdateProjectDocumentDocs,
} from '@/project-documents/project-documents.swagger';
import {
  CreateProjectDocumentDto,
  CreateProjectDocumentsBatchDto,
  QueryProjectDocumentsDto,
  UpdateProjectDocumentDto,
} from '@/project-documents/dto/project-document.dto';

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

  @ApiListProjectDocumentsDocs()
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

  @ApiGetProjectDocumentDocs()
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

  @ApiCreateProjectDocumentDocs()
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

  @ApiCreateProjectDocumentsBatchDocs()
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

  @ApiUpdateProjectDocumentDocs()
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

  @ApiDeleteProjectDocumentDocs()
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
