import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { InactivityTracker } from '@/components/auth/inactivity-tracker'
import { SessionTimeoutTracker } from '@/components/auth/session-timeout-tracker'
import { GoogleAuthProvider } from '@/components/providers/google-auth-provider'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'SecureVault - Digital Asset Inheritance Platform',
  description: 'Securely store and transfer your digital assets to trusted nominees. Blockchain-powered security with automated inheritance.',
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
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <GoogleAuthProvider>
          {children}
          <SessionTimeoutTracker />
          <InactivityTracker />
          <Toaster richColors position="top-right" />
          <Analytics />
        </GoogleAuthProvider>
      </body>
    </html>
  )
}
