import 'server-only'

import SupabaseProvider from '@/db/supabase-provider'
import './globals.css'
import Sidebar from './sidebar'
import { Readex_Pro, Josefin_Slab, Satisfy } from 'next/font/google'
import { BottomNavBar } from './bottom-nav-bar'
import Script from 'next/script'
import { CompleteProfileBanner } from '@/components/complete-profile-banner'
import { Toaster } from 'react-hot-toast'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Suspense } from 'react'
import { OAuthCodeHandler } from '@/components/oauth-code-handler'
import { MainColumn, ShellChrome } from './shell'

const readex = Readex_Pro({ subsets: ['latin'], variable: '--font-readex-pro' })
const josefin = Josefin_Slab({
  subsets: ['latin'],
  variable: '--font-josefin-slab',
})
const satisfy = Satisfy({
  subsets: ['latin'],
  variable: '--font-satisfy-regular',
  weight: '400',
})
const fontVars = [readex.variable, josefin.variable, satisfy.variable].join(' ')

export const metadata = {
  metadataBase: new URL('https://manifund.org'),
  title: {
    default: 'Manifund',
    template: '%s | Manifund',
  },
  description: 'Fast, transparent grants',
  openGraph: {
    siteName: 'Manifund',
    type: 'website',
    title: 'Manifund',
    description: 'Fast, transparent grants',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <head />
      <body className="min-h-screen w-full bg-gray-50">
        <SupabaseProvider
          className={`mx-auto mb-20 w-full font-sans lg:grid lg:max-w-7xl lg:grid-cols-12 lg:gap-x-2 xl:max-w-7xl xl:gap-x-8`}
        >
          <Toaster />
          <ShellChrome>
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
          </ShellChrome>
          <MainColumn>
            <ShellChrome>
              <Suspense fallback={null}>
                <CompleteProfileBanner />
              </Suspense>
            </ShellChrome>
            {children}
          </MainColumn>
          <ShellChrome>
            <Suspense fallback={null}>
              <BottomNavBar />
            </Suspense>
          </ShellChrome>
          <Suspense fallback={null}>
            <OAuthCodeHandler />
          </Suspense>
        </SupabaseProvider>
        <Script
          src="https://analytics.umami.is/script.js"
          data-website-id="5bd676d9-a4fd-4b50-bed5-b15a561c7374"
        />
        <SpeedInsights />
      </body>
    </html>
  )
}
