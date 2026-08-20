import { permanentRedirect } from 'next/navigation';

/**
 * `/profile` moved to `/account` when the page grew from a profile form into
 * account management.
 *
 * A permanent redirect rather than a deleted route: the old path was the only
 * authenticated destination in the header dropdown for months, so it is in
 * people's history and their bookmarks. `permanentRedirect` is a 308, which the
 * browser caches, so the hop happens once per person rather than on every visit.
 */
export default function ProfilePage() {
    permanentRedirect('/account');
}
