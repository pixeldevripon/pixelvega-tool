import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SlackService } from './slack.service';

// Resolves and caches a User's Slack user ID. Kept out of SlackService,
// which is otherwise a thin, stateless wrapper over the Slack Web API.
// This also reads and writes User.slackUserId, so it lives alongside it
// instead.
@Injectable()
export class SlackUserResolverService {
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
      return null;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { slackUserId },
    });

    return slackUserId;
  }
}
