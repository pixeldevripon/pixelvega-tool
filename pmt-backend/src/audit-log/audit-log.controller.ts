import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { QueryAuditLogDto } from '@/audit-log/dto/audit-log.dto';
import { ApiListAuditLogDocs } from './audit-log.swagger';
import { AuditLogService } from './audit-log.service';

/** Routing only. Documentation lives in audit-log.swagger.ts. */
@ApiTags('Audit Logs')
@ApiCookieAuth('better-auth.session_token')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiListAuditLogDocs()
  @RequirePermissions(Permission.VIEW_AUDIT_LOG)
  @Get()
  findAll(@Query() query: QueryAuditLogDto) {
    return this.auditLogService.findAll(query);
  }
}
