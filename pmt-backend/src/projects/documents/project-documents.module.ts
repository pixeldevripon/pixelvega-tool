import { Module } from '@nestjs/common';
import { UploadsModule } from '@/uploads/uploads.module';
import { ProjectDocumentsController } from './project-documents.controller';
import { ProjectDocumentsService } from './project-documents.service';

/** Project documents: uploaded files and typed text, grouped into revisions. */
@Module({
  imports: [UploadsModule],
  controllers: [ProjectDocumentsController],
  providers: [ProjectDocumentsService],
  exports: [ProjectDocumentsService],
})
export class ProjectDocumentsModule {}
