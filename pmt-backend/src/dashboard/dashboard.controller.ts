import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';

import { PermissionsService } from '@/auth/permissions/permissions.service';
import { RequirePermissions } from '@/auth/permissions/require-permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DashboardService } from '@/dashboard/dashboard.service';
import { ApiGetDashboardDocs } from '@/dashboard/dashboard.swagger';
import { QueryDashboardDto } from '@/dashboard/dto/dashboard.dto';

/**
 * The landing screen.
 *
 * Top level and read only, so it lives at `src/dashboard/` serving `/dashboard`
 * (ADR 0004). It is not nested under `projects/` even though projects are most
 * of what it shows: it spans every project the caller can see, plus their own
 * hours, blockers and standup, so it is not scoped to one project id.
 *
 * ONE route, deliberately, rather than one per audience. Working out which
 * dashboard you are entitled to is derivation, and doing it in a browser means a
 * second copy of the rule that decides it (D4). The permission set is resolved
 * here and handed to the service, which answers with the block that applies.
 */
@ApiTags('Dashboard')
@ApiCookieAuth('better-auth.session_token')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ApiGetDashboardDocs()
  @RequirePermissions(Permission.VIEW_DASHBOARD)
  @Get()
  getDashboard(
    @Query() query: QueryDashboardDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    // The same resolver `PermissionsGuard` consults, so the gate and the
    // audience decision can never disagree about what this session may do.
    const permissions = this.permissionsService.getEffectivePermissions(user);
    return this.dashboardService.getDashboard(user, permissions, query);
  }
}
