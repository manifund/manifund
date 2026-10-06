// Stand-in for next/navigation outside Next.js: navigation is a no-op.
const noop = () => {}
const router = { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop }
export const useRouter = () => router
export const usePathname = () => '/'
export const useSearchParams = () => new URLSearchParams('')
export const useParams = () => ({})
export const redirect = noop
export const notFound = noop
