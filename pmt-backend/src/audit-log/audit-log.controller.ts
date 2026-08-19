import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from '@/audit-log/dto/query-audit-log.dto';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

@ApiTags('Audit Logs')
@ApiCookieAuth('better-auth.session_token')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiOperation({
    summary: 'List audit log entries. ADMIN only.',
    description:
      'Paginated, newest first. Filterable by targetType, targetId, and/or userId (the actor).',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  @ApiResponse({ status: 403, description: 'Caller is not ADMIN' })
  @RequirePermissions(Permission.VIEW_AUDIT_LOG)
  @Get()
  findAll(@Query() query: QueryAuditLogDto) {
    return this.auditLogService.findAll(query);
  }
}
