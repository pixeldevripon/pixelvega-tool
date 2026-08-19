import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SystemAdminBootstrapService } from './system-admin-bootstrap.service';
import { MailModule } from '../mail/mail.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [MailModule, ProfilesModule],
  controllers: [UsersController],
  providers: [UsersService, SystemAdminBootstrapService],
})
export class UsersModule {}
