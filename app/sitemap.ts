import type { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/db/supabase-server'

const BASE_URL = 'https://manifund.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createServerSupabaseClient()

  const [projects, profiles, causes, rounds] = await Promise.all([
    supabase
      .from('projects')
      .select('slug, created_at')
      .neq('stage', 'hidden')
      .neq('stage', 'draft')
      .throwOnError()
      .then((r) => r.data ?? []),
    supabase
      .from('profiles')
      .select('username')
      .not('username', 'is', null)
      .throwOnError()
      .then((r) => r.data ?? []),
    supabase
      .from('causes')
      .select('slug')
      .throwOnError()
      .then((r) => r.data ?? []),
    supabase
      .from('rounds')
      .select('slug')
      .throwOnError()
      .then((r) => r.data ?? []),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/projects`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/people`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/causes`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/charity`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/leaderboards`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/finances`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/about/donate`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/about/donor-faq`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/about/grantee-faq`, changeFrequency: 'monthly', priority: 0.4 },
    {
      url: `${BASE_URL}/about/impact-certificates`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    { url: `${BASE_URL}/about/open-call`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/about/regranting`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/docs`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE_URL}/projects/${p.slug}`,
    lastModified: p.created_at ? new Date(p.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((p) => ({
    url: `${BASE_URL}/${p.username}`,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  const causeRoutes: MetadataRoute.Sitemap = causes.map((c) => ({
    url: `${BASE_URL}/causes/${c.slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const roundRoutes: MetadataRoute.Sitemap = rounds.map((r) => ({
    url: `${BASE_URL}/rounds/${r.slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...projectRoutes, ...profileRoutes, ...causeRoutes, ...roundRoutes]
}
