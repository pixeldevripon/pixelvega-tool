import { Injectable, Logger } from '@nestjs/common';
import { WebClient } from '@slack/web-api';

const MAX_NAME_COLLISION_ATTEMPTS = 5;

// Thin wrapper over the Slack Web API, same shape as MailService. Every
// method catches and logs its own errors and never throws, since nothing
// in this feature is allowed to fail an unrelated request.
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly client = new WebClient(process.env.SLACK_BOT_TOKEN);

  async createProjectChannel(baseName: string): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_NAME_COLLISION_ATTEMPTS; attempt++) {
      const name = attempt === 1 ? baseName : `${baseName}-${attempt}`;
      try {
        const result = await this.client.conversations.create({
          name,
          is_private: true,
        });
        return result.channel?.id ?? null;
      } catch (error) {
        if (this.errorCode(error) === 'name_taken') {
          continue;
        }
        this.logger.warn(
          `Failed to create Slack channel "${name}": ${this.describeError(error)}`,
        );
        return null;
      }
    }

    this.logger.warn(
      `Giving up creating a Slack channel for base name "${baseName}" after ${MAX_NAME_COLLISION_ATTEMPTS} name collisions`,
    );
    return null;
  }

  async inviteToChannel(channelId: string, slackUserId: string): Promise<void> {
    try {
      await this.client.conversations.invite({
        channel: channelId,
        users: slackUserId,
      });
    } catch (error) {
      if (this.errorCode(error) === 'already_in_channel') {
        return;
      }
      this.logger.warn(
        `Failed to invite Slack user ${slackUserId} to channel ${channelId}: ${this.describeError(error)}`,
      );
    }
  }

  async removeFromChannel(
    channelId: string,
    slackUserId: string,
  ): Promise<void> {
    try {
      await this.client.conversations.kick({
        channel: channelId,
        user: slackUserId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to remove Slack user ${slackUserId} from channel ${channelId}: ${this.describeError(error)}`,
      );
    }
  }

  async postMessage(channelId: string, text: string): Promise<string | null> {
    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
      });
      return result.ts ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to post Slack message to channel ${channelId}: ${this.describeError(error)}`,
      );
      return null;
    }
  }

  async updateMessage(
    channelId: string,
    ts: string,
    text: string,
  ): Promise<void> {
    try {
      await this.client.chat.update({ channel: channelId, ts, text });
    } catch (error) {
      this.logger.warn(
        `Failed to update Slack message ${ts} in channel ${channelId}: ${this.describeError(error)}`,
      );
    }
  }

  // Used before manually linking an existing channel (as opposed to
  // creating a new one). Confirms the bot can actually see it, since a bad
  // or private channel id would otherwise silently break every future
  // invite/post.
  async verifyChannelAccessible(channelId: string): Promise<boolean> {
    try {
      const result = await this.client.conversations.info({
        channel: channelId,
      });
      return result.channel?.id === channelId && !result.channel?.is_archived;
    } catch (error) {
      this.logger.warn(
        `Failed to verify Slack channel ${channelId}: ${this.describeError(error)}`,
      );
      return false;
    }
  }

  async lookupUserIdByEmail(email: string): Promise<string | null> {
    try {
      const result = await this.client.users.lookupByEmail({ email });
      return result.user?.id ?? null;
    } catch (error) {
      const code = this.errorCode(error);
      if (code === 'users_not_found' || code === 'user_not_found') {
        this.logger.debug(`No Slack user found for email ${email}`);
      } else {
        this.logger.warn(
          `Failed to look up Slack user for email ${email}: ${this.describeError(error)}`,
        );
      }
      return null;
    }
  }

  private errorCode(error: unknown): string | undefined {
    return (error as { data?: { error?: string } })?.data?.error;
  }

  private describeError(error: unknown): string {
    return this.errorCode(error) ?? (error as Error)?.message ?? String(error);
  }
}
