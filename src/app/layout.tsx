import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { StoreProvider } from '@/store/StoreProvider';
import { TwilioProvider } from '@/context/TwilioContext';
import AppClientLayout from './AppClientLayout';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// Metadata is correctly exported from a Server Component.
export const metadata: Metadata = {
  title: 'Voice by WHUB',
  description: 'Manage your calls with ease and AI-powered insights.',
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="font-body antialiased h-full bg-muted/40" suppressHydrationWarning>
        {/* next/script avoids React 19's "script tag while rendering" warning for FOUC theme init */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <StoreProvider>
            <AuthProvider>
              <TwilioProvider>
                <AppClientLayout>{children}</AppClientLayout>
              </TwilioProvider>
            </AuthProvider>
          </StoreProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
