
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
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { LogOut, Phone, Building, Users, Settings, LayoutGrid, ChevronDown, UserCog, Package, CreditCard } from 'lucide-react';
import { Button } from './ui/button';
import { Logo } from './icons';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDashboardOpen, setIsDashboardOpen] = useState(pathname.startsWith('/dashboard'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/settings'));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isSuperAdmin = user?.role_id === 1;
  const isCompanyAdmin = user?.role_id === 2;
  const isRegularUser = user?.role_id === 3;

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const usersLink = user?.company_id ? `/companies/${user.company_id}/users` : '/companies';


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
          
          {(isCompanyAdmin || isRegularUser) && (
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

          {isSuperAdmin && (
            <>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/companies')} tooltip="Companies">
                <Link href="/companies">
                  <Building />
                  <span>Companies</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/packages')} tooltip="Packages">
                <Link href="/packages">
                  <Package />
                  <span>Packages</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </>
          )}

           {isCompanyAdmin && (
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/companies') && pathname.endsWith('/users')} tooltip="Users">
                  <Link href={usersLink}>
                    <Users />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
           )}
        </SidebarGroup>
        
        <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
             <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                         <SidebarMenuButton tooltip="Settings" className="justify-between">
                            <div className="flex items-center gap-2">
                                <Settings />
                                <span>Settings</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden ${isSettingsOpen ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                </SidebarMenuItem>
                 <CollapsibleContent>
                    <SidebarMenuSub>
                       <SidebarMenuItem>
                            <SidebarMenuSubButton asChild isActive={pathname === '/profile'}>
                               <Link href="/profile">Profile</Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                         {(isSuperAdmin || isCompanyAdmin) && (
                            <SidebarMenuItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/settings'}>
                                  <Link href="/settings">Company</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuItem>
                         )}
                         {(isCompanyAdmin || isRegularUser) && (
                            <SidebarMenuItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/settings/billing'}>
                                  <Link href="/settings/billing">Billing</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuItem>
                         )}
                    </SidebarMenuSub>
                 </CollapsibleContent>
              </Collapsible>
        </SidebarGroup>
      </SidebarMenu>
      
      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <SidebarSeparator />
          <div className="p-2 flex items-center gap-2">
              <Avatar className="h-9 w-9">
                  <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user?.name} />
                  <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm">
                  <span className="font-semibold text-foreground">{user?.name}</span>
                  <span className="text-muted-foreground">{user?.email}</span>
              </div>
          </div>
        </div>
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

