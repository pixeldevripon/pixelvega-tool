import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Partial prerendering, which in Next.js 16 is what `cacheComponents` turns
   * on. It replaces the `experimental.ppr`, `dynamicIO` and `useCache` flags of
   * earlier versions.
   *
   * With it on, a route is no longer all-static or all-dynamic. The static
   * shell is prerendered and served immediately, and anything that reads
   * runtime data streams in behind a `<Suspense>` boundary. Three routes here
   * awaited `params` or `searchParams` and were therefore fully dynamic; they
   * now report `◐` in the build output, meaning static HTML with the
   * session-dependent parts streamed.
   *
   * The cost is that Next.js becomes strict about uncached runtime data outside
   * a boundary and fails the build rather than silently making the whole page
   * dynamic. That strictness is the feature: it caught `DashboardShell` reading
   * `usePathname()` above every boundary, which was blocking the entire
   * document on the navigation.
   */
  cacheComponents: true,

  /**
   * This package is its own root.
   *
   * Without this, Turbopack walks up, finds the repository's lockfile, and
   * infers the monorepo root, which makes it watch the backend's `src/` and
   * `node_modules/` as well. Both packages install independently here, so the
   * frontend directory is the correct root.
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
