
'use client';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { StoreProvider } from '@/store/StoreProvider';
import { TwilioProvider, useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// Metadata must be exported from a Server Component.
// We will move the client logic into a separate component.
export const metadata: Metadata = {
  title: 'CallSync',
  description: 'Manage your calls with ease and AI-powered insights.',
};

function AppLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingReservation, 
    acceptReservation, 
    rejectReservation, 
    clearIncomingReservation 
  } = useTwilio();

  const callerName = incomingReservation?.task?.attributes?.from_name || "Unknown Caller";
  const callerNumber = incomingReservation?.task?.attributes?.from || "";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingReservation}
        onClose={clearIncomingReservation}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={() => acceptReservation()}
        onReject={() => rejectReservation()}
      />
    </>
  );
}


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
              <AppLayout>{children}</AppLayout>
            </TwilioProvider>
          </AuthProvider>
        </StoreProvider>
        <Toaster />
      </body>
    </html>
  );
}
