
'use client';

import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup } from '@/components/ui/sidebar';
import { Hash, Inbox, MessageSquare, Users } from 'lucide-react';
import { Logo } from './icons';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function InAppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-foreground group-data-[collapsible=icon]:hidden">
            CallSync
          </span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/app'}>
                        <Link href="/app">
                            <Inbox />
                            <span>Inbox</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/contacts')}>
                        <Link href="/contacts">
                            <Users />
                            <span>Contacts</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="#">
                            <Hash />
                            <span>All Channels</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="#">
                            <MessageSquare />
                            <span>Threads</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
