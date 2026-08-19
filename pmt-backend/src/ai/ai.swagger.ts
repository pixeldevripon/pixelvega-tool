import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  commonErrors,
  conflict,
  gatedErrors,
  notFound,
} from '@/common/swagger/error-sets';

/** Documentation for the AI template reference data AiModule owns. */

export const ApiListAiTemplatesDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'List AI templates',
      description:
        'A template is a structural outline dropped into the system prompt, with no ' +
        'templating engine and no variable substitution. Exactly one row per kind is ' +
        'the default, enforced by a partial unique index. The scope checker uses no ' +
        'template at all, because its output is a strict structured schema rather than prose.',
    }),
    ApiResponse({ status: 200, description: 'Every template' }),
    ...commonErrors,
  );

export const ApiCreateAiTemplateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create an AI template',
      description:
        'Marking one default clears the flag on the previous default for that kind.',
    }),
    ApiResponse({ status: 201, description: 'The created template' }),
    ...gatedErrors,
    conflict('Another template of this kind is already the default'),
  );

export const ApiUpdateAiTemplateDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update an AI template' }),
    ApiParam({ name: 'id', description: 'The template id' }),
    ApiResponse({ status: 200, description: 'The updated template' }),
    ...gatedErrors,
    notFound('Template not found'),
  );

export const ApiDeleteAiTemplateDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Delete an AI template',
      description:
        'The default template for a kind cannot be deleted while it is the default.',
    }),
    ApiParam({ name: 'id', description: 'The template id' }),
    ApiResponse({ status: 200, description: 'Deleted' }),
    ...gatedErrors,
    notFound('Template not found'),
    conflict('This template is the default for its kind'),
  );
