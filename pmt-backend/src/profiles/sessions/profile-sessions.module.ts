import { Module } from '@nestjs/common';

import { ProfileSessionsController } from './profile-sessions.controller';
import { ProfileSessionsService } from './profile-sessions.service';

/**
 * Its own module rather than more routes on `ProfilesModule`.
 *
 * A profile is a description of a person; a session is a live credential. They
 * are read by the same screen and share nothing else: no service, no table, and
 * no reason for a change to one to touch the other.
 *
 * `PrismaModule` and `AuditLogModule` are `@Global()`, so neither is imported.
 */
@Module({
  controllers: [ProfileSessionsController],
  providers: [ProfileSessionsService],
})
export class ProfileSessionsModule {}
