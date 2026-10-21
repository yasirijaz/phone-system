
'use client';

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { LogOut, Phone, Building, Users, Settings, LayoutGrid, UserCog, Package, CreditCard, AppWindow, UploadCloud, Plug, Radio, FileSearch, Tags, Bot, BarChart3 } from 'lucide-react';
import { Button } from './ui/button';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { isElectron } from '@/lib/is-electron';
import {
  isPlatformAdmin,
  isCompanyAdmin,
  isManager,
  isRegularUser,
  isCompanyScopedAdmin,
  canAccessDepartments,
  canAccessBilling,
  canAccessCompanySettings,
  canAccessCallAnalysis,
  canAccessAiCalls,
  canAccessCallOutcomes,
  canAccessLiveIntel,
  canAccessDashboard,
} from '@/lib/roles';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const inElectron = isElectron();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isSuperAdmin = isPlatformAdmin(user?.role_id);
  const isAdmin = isCompanyAdmin(user?.role_id);
  const isMgr = isManager(user?.role_id);
  const isUser = isRegularUser(user?.role_id);
  const isScopedAdmin = isCompanyScopedAdmin(user?.role_id);
  const showDashboard = canAccessDashboard(user?.role_id);
  const showLiveIntel = canAccessLiveIntel(user?.role_id);
  const showCallAnalysis = canAccessCallAnalysis(user?.role_id);
  const showAiCalls = canAccessAiCalls(user?.role_id);
  const showCallOutcomes = canAccessCallOutcomes(user?.role_id);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const usersLink = user?.company_id ? `/companies/${user.company_id}/members` : '/companies';


  return (
    <>
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-2">
          <Image
            src="/logo.png"
            alt="Voice by WHUB"
            width={180}
            height={48}
            className="w-auto"
            priority
            sizes="(max-width: 768px) 140px, 180px"
          />
        </div>
      </SidebarHeader>
      
      <SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel>MENU</SidebarGroupLabel>
          
          {(isAdmin || isMgr || isUser) && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/app')} tooltip="Go To App">
                  <Link href="/app">
                    <AppWindow />
                    <span>Go To App</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!inElectron && showDashboard && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')} tooltip="Dashboard">
                    <Link href="/dashboard">
                      <LayoutGrid />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showLiveIntel && !inElectron && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/live-calls')} tooltip="Live Calls">
                    <Link href="/live-calls">
                      <Radio />
                      <span>Live Intel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showCallAnalysis && !inElectron && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/call-analysis')} tooltip="Call Analysis">
                    <Link href="/call-analysis">
                      <FileSearch />
                      <span>Analysis</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showAiCalls && !inElectron && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/ai-calls'} tooltip="AI Call Log">
                    <Link href="/ai-calls">
                      <Bot />
                      <span>AI Call Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showAiCalls && !inElectron && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/ai-calls/dashboard')} tooltip="AI Insights">
                    <Link href="/ai-calls/dashboard">
                      <BarChart3 />
                      <span>AI Insights</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {showCallOutcomes && !inElectron && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/call-outcomes')} tooltip="Call Outcomes">
                    <Link href="/call-outcomes">
                      <Tags />
                      <span>Outcomes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </>
          )}
           {canAccessDepartments(user?.role_id) && (
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/departments'} tooltip="Departments">
                  <Link href="/departments">
                    <Building />
                    <span>Departments</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
               <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/integrations')} tooltip="Integrations">
                  <Link href="/integrations">
                    <Plug />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}

           {isScopedAdmin && (
            <>
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/companies') && pathname.endsWith('/members')} tooltip="Users">
                  <Link href={usersLink}>
                    <Users />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/media')} tooltip="Media">
                    <Link href="/media">
                        <UploadCloud />
                        <span>Media</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
           )}
        </SidebarGroup>
        
        <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            {canAccessCompanySettings(user?.role_id) && (
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip="Settings">
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            )}
            {canAccessBilling(user?.role_id) && (
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/settings/billing'} tooltip="Billing">
                <Link href="/settings/billing">
                  <CreditCard />
                  <span>Billing</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            )}
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
