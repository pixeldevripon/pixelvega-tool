import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { notFound, projectScopedErrors } from '@/common/swagger/error-sets';
import {
  PaginatedProjectDocumentsResponseDto,
  ProjectDocumentDetailResponseDto,
  ProjectDocumentResponseDto,
  RemoveProjectDocumentResponseDto,
} from '@/projects/documents/dto/project-document.dto';

const projectIdParam = ApiParam({
  name: 'projectId',
  description: 'The project id',
});
const documentIdParam = ApiParam({
  name: 'id',
  description: 'The document id',
});

const singleFileBody = ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      type: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
  },
});

export const ApiListProjectDocumentsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: "List a project's documents",
      description:
        'Grouped into revision history by (type, title): one row per group by default, ' +
        'the newest in each. That grouping is a CONVENTION, not enforced on write, so ' +
        'reuploading under the same title is a new row rather than a replacement, and a ' +
        'different title stays its own separate current document. Pass ' +
        'includeHistory=true for every revision, flat. A CLIENT sees DELIVERABLE ' +
        'documents only, and a type filter they send is overridden rather than merged.',
    }),
    projectIdParam,
    ApiQuery({ name: 'includeHistory', required: false, type: Boolean }),
    ApiResponse({
      status: 200,
      description: 'Paginated documents',
      type: PaginatedProjectDocumentsResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiGetProjectDocumentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get a single project document',
      description:
        "Includes supersededBy, naming the current newest row in this document's " +
        '(type, title) group when the one requested is not it, so a stale link is ' +
        'visibly stale.',
    }),
    projectIdParam,
    documentIdParam,
    ApiResponse({
      status: 200,
      description: 'The document',
      type: ProjectDocumentDetailResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Document not found'),
  );

export const ApiCreateProjectDocumentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Add a project document',
      description:
        'A document is either an uploaded FILE or typed TEXT, never both. Files go to ' +
        'Cloudinary; anything that is not an image is stored as a raw resource, because ' +
        'an image resource type would let it be transformed and re-served.',
    }),
    ApiConsumes('multipart/form-data'),
    singleFileBody,
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The created document',
      type: ProjectDocumentResponseDto,
    }),
    ...projectScopedErrors,
  );

export const ApiCreateProjectDocumentsBatchDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Add several project documents in one request',
      description:
        'Up to ten files, each becoming its own document titled after its original ' +
        'filename (truncated to 200 characters) and sharing the type and description. ' +
        'The rows are written in one transaction, so either every file lands or none ' +
        'does: a batch reported as failed leaves no documents behind and no orphaned ' +
        'uploads. Use the single file route when each needs its own title.',
    }),
    ApiConsumes('multipart/form-data'),
    projectIdParam,
    ApiResponse({
      status: 201,
      description: 'The created documents',
      type: [ProjectDocumentResponseDto],
    }),
    ...projectScopedErrors,
  );

export const ApiUpdateProjectDocumentDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Edit a project document' }),
    projectIdParam,
    documentIdParam,
    ApiResponse({
      status: 200,
      description: 'The updated document',
      type: ProjectDocumentResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Document not found'),
  );

export const ApiDeleteProjectDocumentDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete a project document',
      description: 'Soft delete, so the revision history stays intact.',
    }),
    projectIdParam,
    documentIdParam,
    ApiResponse({
      status: 200,
      description: 'Deleted',
      type: RemoveProjectDocumentResponseDto,
    }),
    ...projectScopedErrors,
    notFound('Document not found'),
  );
