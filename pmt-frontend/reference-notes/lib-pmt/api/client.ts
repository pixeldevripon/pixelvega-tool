/**
 * A re-export, kept only while the migration runs.
 *
 * Every module under `lib/api/` imported `apiRequest` and `ApiError` from here,
 * so pointing the old names at `fetch.ts` means one file changed rather than
 * fifteen, and no call site had to be edited to gain the timeout fix, the
 * retry, and the humane error messages.
 *
 * `apiRequest` is `apiFetch` under a different name. It is an alias rather than
 * a wrapper on purpose: a wrapper would be a second place for behaviour to
 * accumulate, and the point is that there is only one.
 *
 * **Delete this file at the end of phase 8**, once nothing imports it. It is
 * listed as an item there. New code imports `@/lib/api/fetch` directly.
 */

export {
  apiFetch as apiRequest,
  apiFetch,
  apiDownload,
  ApiError,
  type ApiRequestOptions,
  type DownloadResult,
} from "@/lib/api/fetch";
