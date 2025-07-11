
'use client';

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { LogOut, Phone, Building, Users, Settings, LayoutGrid, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Logo } from './icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDashboardOpen, setIsDashboardOpen] = useState(pathname.startsWith('/dashboard'));

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
              <Collapsible open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                         <SidebarMenuButton tooltip="Dashboard" className="justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid />
                                <span>Dashboard</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden ${isDashboardOpen ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                 <CollapsibleContent>
                    <SidebarMenuSub>
                       <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/ecommerce'}>
                               <Link href="/dashboard/ecommerce">eCommerce</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/calls'}>
                               <Link href="/dashboard/calls">Calls</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                    </SidebarMenuSub>
                 </CollapsibleContent>
              </Collapsible>
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
