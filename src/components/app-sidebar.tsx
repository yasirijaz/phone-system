
'use client';

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { LogOut, Phone, Building, Users, Settings, LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';
import { Logo } from './icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

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
      
      <SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel>MENU</SidebarGroupLabel>
          {user?.role_id === 1 ? (
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/companies')} tooltip="Companies">
                <Link href="/companies">
                  <Building />
                  <span>Companies</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/'} tooltip="Dashboard">
                  <Link href="/">
                    <LayoutGrid />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/departments'} tooltip="Departments">
                  <Link href="/departments">
                    <Building />
                    <span>Departments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarGroup>
        
        <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/profile'} tooltip="Profile">
                <Link href="/profile">
                  <Users />
                  <span>Profile</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip="Settings">
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarGroup>
      </SidebarMenu>
      
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
        >
          <LogOut />
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </>
  );
}
