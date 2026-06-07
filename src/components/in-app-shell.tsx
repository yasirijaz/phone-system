'use client';

import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { InAppSidebar } from '@/components/in-app-sidebar';

export function InAppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <InAppSidebar />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
