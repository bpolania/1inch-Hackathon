import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NEAR Intents - Chain Abstraction Made Simple',
  description: 'Express what you want, let solvers figure out how to make it happen across chains',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        {children}
        <div id="near-wallet-selector-modal" />
      </body>
    </html>
  )
}