
'use client';

import { useState, useEffect } from 'react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Hash, Inbox, LayoutGrid, MessageSquare, Users, Building, Clock } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getUserDepartments } from '@/services/userService';
import { getCommunications } from '@/services/callLogService';
import type { Department, Communication, Contact } from '@/types';
import { Badge } from './ui/badge';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getContacts } from '@/services/contactService';

interface DepartmentWithUnread extends Department {
    unread_count: number;
}

interface RecentItem {
    id: string;
    name: string;
    href: string;
    initials: string;
}

export function InAppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithUnread[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const inElectron = isElectron();

  const getInitials = (name: string) => {
    if (!name) return '?';
    const nameParts = name.split(' ').filter(Boolean);
    if (nameParts.length > 1) {
      return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const fetchSidebarData = async () => {
      try {
        setLoading(true);
        if (!user.id || !user.company_id) return;

        const [userDepts, recentComms, contacts] = await Promise.all([
            getUserDepartments(user.id),
            getCommunications({ limit: 50 }), // Fetch more to find unique contacts
            getContacts(user.company_id),
        ]);
        
        const deptsArray = Array.isArray(userDepts) ? userDepts : [];

        const deptsWithCounts = await Promise.all(
          deptsArray.map(async (dept) => {
            const comms = await getCommunications({ department_id: dept.id, type: 'unread', limit: 1000 });
            const unreadCount = comms.results.filter(c => !c.is_read).length;
            return { ...dept, unread_count: unreadCount };
          })
        );
        
        if (mounted) setDepartments(deptsWithCounts);

        // Process recent communications to create a unique list of contacts
        const uniqueRecents: { [key: string]: RecentItem } = {};
        const seenNumbers = new Set<string>();

        recentComms.results.forEach((comm: Communication) => {
            const otherPartyNumber = comm.direction === 'inbound' ? comm.from : comm.to;
            const fromNumber = comm.direction === 'inbound' ? comm.to : comm.from;

            if (!seenNumbers.has(otherPartyNumber)) {
                seenNumbers.add(otherPartyNumber);
                const contact = contacts.find((c: Contact) => c.phone_no === otherPartyNumber);
                const name = contact?.name || otherPartyNumber;
                uniqueRecents[otherPartyNumber] = {
                    id: otherPartyNumber,
                    name: name,
                    href: `/conversations/${encodeURIComponent(fromNumber)}/${encodeURIComponent(otherPartyNumber)}`,
                    initials: getInitials(name),
                };
            }
        });
        
        if (mounted) {
            setRecentItems(Object.values(uniqueRecents).slice(0, 10));
        }

      } catch (error) {
        console.error("Failed to fetch sidebar data", error);
        if (mounted) {
            setDepartments([]);
            setRecentItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSidebarData();

    const refreshHandler = () => fetchSidebarData();
    events.on('refreshDepartmentsUnread', refreshHandler);
    events.on('refreshCalls', refreshHandler);

    return () => {
      mounted = false;
      events.off('refreshDepartmentsUnread', refreshHandler);
      events.off('refreshCalls', refreshHandler);
    };
  }, [user]);

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-2">
          <Image
            src="/logo.png"
            alt="CallSync"
            width={180}
            height={48}
            className="h-12 w-auto"
            priority
            sizes="(max-width: 768px) 140px, 180px"
          />
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
            <SidebarMenu>
                {!inElectron && (
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                          <Link href="/dashboard/ecommerce">
                              <LayoutGrid />
                              <span>Dashboard</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
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
         <SidebarGroup>
            <SidebarGroupLabel>Recents</SidebarGroupLabel>
            <SidebarMenu>
                 {loading ? (
                    <SidebarMenuItem>
                        <SidebarMenuButton disabled>Loading...</SidebarMenuButton>
                    </SidebarMenuItem>
                ) : recentItems.length > 0 ? (
                    recentItems.map((item) => (
                        <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton asChild isActive={pathname.includes(item.href)}>
                                <Link href={item.href} className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-5 w-5 text-xs">
                                            <AvatarFallback>{item.initials}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))
                ) : (
                     <SidebarMenuItem>
                        <SidebarMenuButton disabled>No recent activity</SidebarMenuButton>
                    </SidebarMenuItem>
                )}
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
