import { Global, Module } from '@nestjs/common';

import { ProjectScopeService } from './project-scope.service';

/**
 * `@Global()` for the same reason `ProjectActivityModule` is: eleven modules
 * need project scoping, and the alternative is either eleven imports of a
 * module that would then have to avoid importing any of them back, or the
 * duplication this replaces.
 */
@Global()
@Module({
  providers: [ProjectScopeService],
  exports: [ProjectScopeService],
})
export class ProjectScopeModule {}
