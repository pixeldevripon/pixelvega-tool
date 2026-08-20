import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import { gatedErrors } from '@/common/swagger/error-sets';
import { DashboardResponseDto } from '@/dashboard/dto/dashboard.dto';

export const ApiGetDashboardDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'The landing screen for the signed in caller',
      description:
        'One request, and exactly one of the two blocks is populated. `audience` ' +
        'says which, and it is resolved from the caller permission set rather ' +
        'than from their role: holding VIEW_AUDIT_LOG makes it the admin view, ' +
        'VIEW_ALL_PROJECTS the manager view, TRACK_PROJECT_TIME the delivery ' +
        'view, and holding none of the three makes it the client view. ' +
        'Which PROJECTS appear is a separate question from which block: an admin ' +
        'and a project manager both see every project, a developer or designer ' +
        'sees only projects they are staffed on, and a client sees only their ' +
        'own. Whether the caller may MANAGE a project they can see is answered ' +
        'per card by its capabilities, so a project manager sees everything and ' +
        'manages only their own. Every figure is already computed, ordered and ' +
        'labelled: nothing on this response needs deriving to render it.',
    }),
    ApiResponse({
      status: 200,
      description: 'The caller dashboard',
      type: DashboardResponseDto,
    }),
    ...gatedErrors,
  );
