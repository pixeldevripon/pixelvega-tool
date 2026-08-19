import { Global, Module } from '@nestjs/common';
import { PermissionsService } from '@/auth/permissions/permissions.service';

/**
 * @Global() for the same reason PrismaModule and AuditLogModule are: the
 * resolver is needed by PermissionsGuard (which Nest instantiates in the root
 * module) AND by any controller that wants to report the caller's own
 * permission set. Making every feature module import it would be noise, and
 * forgetting to would be a DI failure at boot rather than a compile error.
 *
 * This module exists at all because providing PermissionsService directly in
 * AppModule is not enough: Nest resolves a controller's dependencies from ITS
 * OWN module, so UsersController could not see it. An E2E boot caught that; no
 * unit test could, because each spec constructs its subject directly.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
