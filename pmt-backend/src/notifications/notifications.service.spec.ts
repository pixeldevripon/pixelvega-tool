import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationType, ProjectRole, Role } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { SlackService } from '@/slack/slack.service';
import { SlackUserResolverService } from '@/slack/slack-user-resolver.service';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    projectMember: { findMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const slackService = { postMessage: jest.fn() };
  const slackUserResolver = { resolveSlackUserId: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SlackService, useValue: slackService },
        { provide: SlackUserResolverService, useValue: slackUserResolver },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  describe('notify', () => {
    it('writes the notification with every field it was given', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      await service.notify({
        userId: 'u1',
        type: NotificationType.LEAVE_REQUEST_APPROVED,
        title: 'Your leave request was approved',
        message: 'Enjoy',
        metadata: { leaveRequestId: 'l1' },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: NotificationType.LEAVE_REQUEST_APPROVED,
          title: 'Your leave request was approved',
          message: 'Enjoy',
          metadata: { leaveRequestId: 'l1' },
        },
      });
    });

    it('does not send a Slack DM unless asked', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      await service.notify({
        userId: 'u1',
        type: NotificationType.PROJECT_CREATED,
        title: 'A new project',
      });
      expect(slackService.postMessage).not.toHaveBeenCalled();
    });

    it('returns the notification even when the Slack DM fails', async () => {
      // The DM is best effort. A Slack outage must not fail the action that
      // produced the notification, which is why it is never awaited.
      prisma.notification.create.mockResolvedValue({ id: 'n1' });
      prisma.user.findUnique.mockRejectedValue(new Error('slack is down'));
      await expect(
        service.notify({
          userId: 'u1',
          type: NotificationType.MEMBER_HANDOVER,
          title: 'You joined a project',
          slackDm: true,
        }),
      ).resolves.toEqual({ id: 'n1' });
    });
  });

  describe('markRead', () => {
    it('refuses a notification belonging to someone else, as a 404 not a 403', async () => {
      // 404 rather than 403 on purpose: telling a caller that a notification
      // exists but is not theirs leaks that it exists.
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'someone-else',
        readAt: null,
      });
      await expect(service.markRead('n1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('404s when it does not exist at all', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('n1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is idempotent: a second read does not move the timestamp', async () => {
      const alreadyRead = {
        id: 'n1',
        userId: 'u1',
        readAt: new Date('2026-08-01T09:00:00.000Z'),
      };
      prisma.notification.findUnique.mockResolvedValue(alreadyRead);
      await expect(service.markRead('n1', 'u1')).resolves.toBe(alreadyRead);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('stamps readAt on the first read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
        readAt: null,
      });
      prisma.notification.update.mockResolvedValue({ id: 'n1' });
      await service.markRead('n1', 'u1');
      const call = prisma.notification.update.mock.calls[0][0] as {
        where: { id: string };
        data: { readAt: Date };
      };
      expect(call.where).toEqual({ id: 'n1' });
      expect(call.data.readAt).toBeInstanceOf(Date);
    });
  });

  describe('markAllRead', () => {
    it('only touches unread rows belonging to the caller', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });
      await expect(service.markAllRead('u1')).resolves.toEqual({
        updatedCount: 4,
      });
      const call = prisma.notification.updateMany.mock.calls[0][0] as {
        where: object;
      };
      // Scoped by userId AND by readAt: null. Dropping either would either
      // mark someone else's notifications read, or rewrite timestamps on
      // notifications that were read days ago.
      expect(call.where).toMatchObject({ userId: 'u1', readAt: null });
    });
  });

  describe('recipient resolution', () => {
    it('combines managing PMs with admins, deduped', async () => {
      // An ADMIN can also hold an active ProjectMember row. Without the dedupe
      // they would be notified twice for one event.
      prisma.projectMember.findMany.mockResolvedValue([
        { userId: 'pm-1' },
        { userId: 'admin-1' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      const ids = await service.resolveManagingPmAndAdminIds('p1');
      expect(ids.sort()).toEqual(['admin-1', 'admin-2', 'pm-1']);
      expect(ids.filter((id) => id === 'admin-1')).toHaveLength(1);
    });

    it('asks only for PROJECT_MANAGER members who have not left', async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      await service.resolveManagingPmAndAdminIds('p1');
      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'p1',
          role: ProjectRole.PROJECT_MANAGER,
          leftAt: null,
        },
        select: { userId: true },
      });
    });

    it('includes every active member, of any role, for the wider audience', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        { userId: 'dev-1' },
        { userId: 'designer-1' },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const ids = await service.resolveAllActiveMembersAndAdminIds('p1');
      expect(ids.sort()).toEqual(['admin-1', 'designer-1', 'dev-1']);
      // No role filter here, unlike the PM-only resolver above.
      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', leftAt: null },
        select: { userId: true },
      });
    });

    it('never includes a deleted admin', async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      await service.resolveAllActiveMembersAndAdminIds('p1');
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { in: [Role.ADMIN, Role.SYSTEM_ADMIN] },
          deletedAt: null,
        },
        select: { id: true },
      });
    });
  });
});
