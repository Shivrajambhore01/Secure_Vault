import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { InactivityTracker } from '@/components/auth/inactivity-tracker'
// import { SessionTimeoutTracker } from '@/components/auth/session-timeout-tracker' // DISABLED: Session timeout removed
import { GoogleAuthProvider } from '@/components/providers/google-auth-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

// Use standard font fallbacks for offline build safety
const inter = { variable: 'font-sans' }

export const metadata: Metadata = {
  title: 'SecureVault - Digital Asset Inheritance Platform',
  description: 'Securely store and transfer your digital assets to trusted nominees. AES-256-powered security with automated inheritance.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1520',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <GoogleAuthProvider>
            {children}
            {/* <SessionTimeoutTracker /> */}
            <InactivityTracker />
            <Toaster richColors position="top-right" />
            <Analytics />
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

