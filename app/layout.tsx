import './globals.css'
import { Figtree } from 'next/font/google'

import Sidebar from '../components/Sidebar'

const font = Figtree({ subsets: ['latin'] })

export const metadata = {
  title: 'StoryCast',
  description: 'Listen to Stories!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={font.className}>
        <Sidebar>
          {children}
        </Sidebar>
      </body>
    </html>
  )
}