
'use client';

import { useState, useEffect } from 'react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Hash, Inbox, LayoutGrid, MessageSquare, Users, Building } from 'lucide-react';
import { Logo } from './icons';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getUserDepartments } from '@/services/userService';
import { getCommunications } from '@/services/callLogService';
import type { Department } from '@/types';
import { Badge } from './ui/badge';

interface DepartmentWithUnread extends Department {
    unread_count: number;
}

export function InAppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithUnread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
        const fetchDepartmentsAndCounts = async () => {
            try {
                setLoading(true);
                const userDepts = await getUserDepartments(user.id);
                const deptsArray = Array.isArray(userDepts) ? userDepts : [];

                const deptsWithCounts = await Promise.all(
                    deptsArray.map(async (dept) => {
                        const comms = await getCommunications({ department_id: dept.id, type: 'unread', limit: 1000 });
                        const unreadCount = comms.results.filter(c => !c.is_read).length;
                        return { ...dept, unread_count: unreadCount };
                    })
                );
                
                setDepartments(deptsWithCounts);

            } catch (error) {
                console.error("Failed to fetch user departments or unread counts", error);
                setDepartments([]);
            } finally {
                setLoading(false);
            }
        };
        fetchDepartmentsAndCounts();
    }
  }, [user]);

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
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                        <Link href="/dashboard/ecommerce">
                            <LayoutGrid />
                            <span>Dashboard</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/app'}>
                        <Link href="/app">
                            <Inbox />
                            <span>Inbox</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/messages')}>
                        <Link href="/messages">
                            <MessageSquare />
                            <span>Messages</span>
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
            </SidebarMenu>
        </SidebarGroup>
         <SidebarGroup>
            <SidebarGroupLabel>Departments</SidebarGroupLabel>
            <SidebarMenu>
                {loading ? (
                    <SidebarMenuItem>
                        <SidebarMenuButton disabled>Loading...</SidebarMenuButton>
                    </SidebarMenuItem>
                ) : departments.length > 0 ? (
                    departments.map((dept) => (
                        <SidebarMenuItem key={dept.id}>
                            <SidebarMenuButton asChild isActive={pathname === `/departments/${dept.id}`}>
                                <Link href={`/departments/${dept.id}`} className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        <span>{dept.name}</span>
                                    </div>
                                    {dept.unread_count > 0 && (
                                        <Badge className="h-5">{dept.unread_count}</Badge>
                                    )}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))
                ) : (
                     <SidebarMenuItem>
                        <SidebarMenuButton disabled>No departments</SidebarMenuButton>
                    </SidebarMenuItem>
                )}
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
