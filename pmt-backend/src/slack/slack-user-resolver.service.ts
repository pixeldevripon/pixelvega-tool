import { Injectable, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SlackService } from './slack.service';

// Resolves and caches a User's Slack user ID. Kept out of SlackService,
// which is otherwise a thin, stateless wrapper over the Slack Web API.
// This also reads and writes User.slackUserId, so it lives alongside it
// instead.
@Injectable()
export class SlackUserResolverService {
  private readonly logger = new Logger(SlackUserResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slackService: SlackService,
  ) {}

  async resolveSlackUserId(
    user: Pick<User, 'id' | 'email' | 'slackUserId'>,
  ): Promise<string | null> {
    if (user.slackUserId) {
      return user.slackUserId;
    }

    const slackUserId = await this.slackService.lookupUserIdByEmail(user.email);
    if (!slackUserId) {
      // Silently returning null here is why a member sometimes never appeared
      // in a project channel and nobody could say why.
      this.logger.warn(
        `No Slack account resolved for ${user.email}; they will not be invited to any channel`,
      );
      return null;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { slackUserId },
    });

    return slackUserId;
  }
}
