
import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body antialiased h-full bg-muted/40" suppressHydrationWarning>
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
