
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { StoreProvider } from '@/store/StoreProvider';
import { TwilioProvider } from '@/context/TwilioContext';
import AppClientLayout from './AppClientLayout';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// Metadata is correctly exported from a Server Component.
export const metadata: Metadata = {
  title: 'CallSync',
  description: 'Manage your calls with ease and AI-powered insights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="font-body antialiased h-full bg-muted/40" suppressHydrationWarning>
        <StoreProvider>
          <AuthProvider>
            <TwilioProvider>
              <AppClientLayout>{children}</AppClientLayout>
            </TwilioProvider>
          </AuthProvider>
        </StoreProvider>
        <Toaster />
      </body>
    </html>
  );
}
