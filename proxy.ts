import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './db/env'

export async function proxy(request: NextRequest) {
  // Trailing-slash redirect, disabled globally in next.config.js so /flux/* keeps its slashes.
  // Plain URL, not nextUrl.clone(): NextURL re-normalizes the pathname back to a trailing slash.
  const { pathname, search } = request.nextUrl

  // Vercel's router 500s on prerendered paths with a backslash appended (e.g.
  // /about/donate%5C serves the static 500 page), and scanners probe these
  // constantly. Strip backslashes here, before Vercel's filesystem lookup.
  const deslashed = pathname.replace(/\\|%5c/gi, '')
  if (deslashed !== pathname) {
    return NextResponse.redirect(new URL((deslashed || '/') + search, request.url), 308)
  }

  if (pathname !== '/' && pathname.endsWith('/')) {
    return NextResponse.redirect(new URL(pathname.slice(0, -1) + search, request.url), 308)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Validates JWT and refreshes session if needed.
  // Do not put code between createServerClient and getClaims().
  await supabase.auth.getClaims()

  return supabaseResponse
}

export const config = {
  // Skip static assets and the PostHog proxy (/flux) so the proxy only runs on requests that use Supabase
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|flux/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
