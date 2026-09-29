/** @type {import('next').NextConfig} */
const { withPostHogConfig } = require('@posthog/nextjs-config')

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
const posthogAssetsHost = posthogHost?.replace('.i.posthog.com', '-assets.i.posthog.com')
const posthogApiKey = process.env.POSTHOG_API_KEY
const posthogProjectId = process.env.POSTHOG_PROJECT_ID

const nextConfig = {
  reactStrictMode: false,
  // PostHog API paths end in '/'; the trailing-slash redirect is re-implemented in proxy.ts
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fkousziwzbnkdkldjper.supabase.co',
        pathname: '/storage/v1/object/public/avatars/*/*',
      },
      {
        protocol: 'https',
        hostname: 'fkousziwzbnkdkldjper.supabase.co',
        pathname: '/storage/v1/object/public/round-header-images/*',
      },
      {
        protocol: 'https',
        hostname: 'fkousziwzbnkdkldjper.supabase.co',
        pathname: '/storage/v1/object/public/round-header-images/*/*',
      },
      {
        protocol: 'https',
        hostname: 'manifold.markets',
      },
      {
        protocol: 'https',
        hostname: 'imgur.com',
        pathname: '/a/h06lDL9',
      },
    ],
  },
  // Reverse proxy for PostHog so adblockers don't block it
  async rewrites() {
    if (!posthogHost || !posthogAssetsHost) return []

    return [
      {
        source: '/flux/static/:path*',
        destination: `${posthogAssetsHost}/static/:path*`,
      },
      {
        source: '/flux/array/:path*',
        destination: `${posthogAssetsHost}/array/:path*`,
      },
      {
        source: '/flux/:path*',
        destination: `${posthogHost}/:path*`,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/essay',
        destination:
          'https://manifoldmarkets.notion.site/Manifund-Essay-Prize-34354492ea7a804dbb44dc4fee8cf82f?source=copy_link',
        permanent: false,
      },
      {
        source: '/surplus',
        destination: 'https://airtable.com/appaxqJfxht7OronH/pag4BXQJgRUkdb6lQ/form',
        permanent: false,
      },
      {
        source: '/discord',
        destination: 'https://discord.com/invite/ZGsDMWSA5Q',
        permanent: false,
      },
      {
        source: '/surplus:star(\\*)',
        destination: 'https://airtable.com/appaxqJfxht7OronH/pag4BXQJgRUkdb6lQ/form',
        permanent: false,
      },
    ]
  },
}

module.exports = withPostHogConfig(nextConfig, {
  personalApiKey: posthogApiKey,
  projectId: posthogProjectId,
  host: process.env.POSTHOG_HOST,
  sourcemaps: {
    enabled: Boolean(posthogApiKey && posthogProjectId),
    deleteAfterUpload: true,
  },
})
