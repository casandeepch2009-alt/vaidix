import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/providers/theme-provider'
import { CommandPalette } from '@/components/shared/command-palette'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Vaidix — Clinical Learning Intelligence',
  description: 'AI-powered conversational learning platform for medical education',
}

// Inline blocking script — runs BEFORE React hydrates so the theme class is
// already on <html> when the page paints. Eliminates flash-of-unstyled-content
// AND prevents next-themes 0.4.x from injecting its own script (which triggers
// React 19's "script tag inside a component" dev warning).
const themeInitScript = `
  (function() {
    try {
      var stored = localStorage.getItem('theme');
      var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var theme = stored || 'light';
      if (theme === 'system') theme = system;
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch (e) {}
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>
          <CommandPalette />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
