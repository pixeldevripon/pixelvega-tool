import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from './fetch';
import { notificationsApi } from './notifications';

/**
 * The path and the method each call sends, asserted as VALUES.
 *
 * `buildQuery` is kept real, because half the point of these cases is what the
 * query string comes out as. Only the transport is mocked.
 */
vi.mock('./fetch', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./fetch')>();
    return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(undefined as never);
});

describe('notificationsApi.list', () => {
    it('sends no query string at all when given nothing', () => {
        void notificationsApi.list();
        expect(apiFetchMock).toHaveBeenCalledWith('/notifications');
    });

    it('sends page and pageSize', () => {
        void notificationsApi.list({ page: 3, pageSize: 20 });
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/notifications?page=3&pageSize=20',
        );
    });

    it('sends unreadOnly=true for the unread tab', () => {
        void notificationsApi.list({ pageSize: 10, unreadOnly: true });
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/notifications?pageSize=10&unreadOnly=true',
        );
    });

    it('OMITS unreadOnly for the all tab rather than sending false', () => {
        // The backend reads this param with `@ToBoolean()`, whose entire reason
        // for existing is that the string 'false' is a real value. "No filter"
        // has to be an absent param, not a falsy one.
        void notificationsApi.list({ pageSize: 10, unreadOnly: false });
        expect(apiFetchMock).toHaveBeenCalledWith('/notifications?pageSize=10');
    });
});

describe('notificationsApi.unreadCount', () => {
    it('reads the aggregate route', () => {
        void notificationsApi.unreadCount();
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/notifications/unread-count',
        );
    });
});

describe('the mark-read mutations', () => {
    it('PATCHes the one notification by id', () => {
        void notificationsApi.markRead('abc-123');
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/notifications/abc-123/read',
            { method: 'PATCH' },
        );
    });

    it('PATCHes the read-all route, which is static and takes no id', () => {
        void notificationsApi.markAllRead();
        expect(apiFetchMock).toHaveBeenCalledWith('/notifications/read-all', {
            method: 'PATCH',
        });
    });
});
