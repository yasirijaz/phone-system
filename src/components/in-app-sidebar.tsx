

'use client';

import { useState, useEffect } from 'react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Hash, Inbox, LayoutGrid, MessageSquare, Users, Building, Clock, BellOff } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getUserDepartments } from '@/services/userService';
import { getCommunications } from '@/services/callLogService';
import { getDndStatus } from '@/services/departmentService';
import type { Department, Communication, Contact } from '@/types';
import { Badge } from './ui/badge';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getContacts } from '@/services/contactService';
import { formatPhoneNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';


interface DepartmentWithUnread extends Department {
    unread_count: number;
    is_dnd: boolean;
}

interface RecentItem {
    id: string;
    name: string;
    href: string;
    initials: string;
    unread_count: number;
}

export function InAppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithUnread[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxUnread, setInboxUnread] = useState(0);
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

        const [userDepts, recentCommsResponse, contacts] = await Promise.all([
            getUserDepartments(user.id),
            getCommunications({ limit: 100 }),
            getContacts(user.company_id),
        ]);
        
        const deptsArray = Array.isArray(userDepts) ? userDepts : [];

        const deptsWithCounts = await Promise.all(
          deptsArray.map(async (dept) => {
            try {
                const [comms, dnd] = await Promise.all([
                    getCommunications({ department_id: dept.id, type: 'unread', limit: 1000 }),
                    getDndStatus(dept.id, user.id)
                ]);
                const unreadCount = Array.isArray(comms.results) ? comms.results.filter(c => !c.is_read).length : 0;
                return { ...dept, unread_count: unreadCount, is_dnd: dnd.is_dnd };
            } catch (e) {
                console.error(`Failed to get data for department ${dept.id}`, e);
                return { ...dept, unread_count: 0, is_dnd: false };
            }
          })
        );
        
        if (mounted) setDepartments(deptsWithCounts);

        const recentComms = Array.isArray(recentCommsResponse.results) ? recentCommsResponse.results : [];
        const uniqueRecents: { [key: string]: RecentItem } = {};

        const inboxUnreadCount = recentComms.filter(c => !c.is_read).length;
        if (mounted) setInboxUnread(inboxUnreadCount);

        recentComms.forEach((comm: Communication) => {
            const otherPartyNumber = comm.direction === 'inbound' ? comm.from : comm.to;
            const fromNumber = comm.direction === 'inbound' ? comm.to : comm.from;

            if (!uniqueRecents[otherPartyNumber]) {
                // check if contacts length is greater then 0
                const contact = (contacts) ? contacts.find((c: Contact) => c.phone_no === otherPartyNumber) : null;
                const name = contact?.name || otherPartyNumber;
                uniqueRecents[otherPartyNumber] = {
                    id: otherPartyNumber,
                    name: name,
                    href: `/conversations/${encodeURIComponent(fromNumber)}/${encodeURIComponent(otherPartyNumber)}`,
                    initials: getInitials(name),
                    unread_count: 0
                };
            }
        });

        // Now count unread for each unique recent contact
        Object.keys(uniqueRecents).forEach(number => {
            const unreadCount = recentComms.filter(
                c => (c.direction === 'inbound' ? c.from : c.to) === number && !c.is_read
            ).length;
            uniqueRecents[number].unread_count = unreadCount;
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
    const handleDndStatusChange = (data: any) => {
      if (data?.department_id == null || data?.is_dnd === undefined) return;

      setDepartments(prevDepartments =>
        prevDepartments.map(dept =>
          dept.id === data.department_id
            ? { ...dept, is_dnd: Boolean(data.is_dnd) }
            : dept
        )
      );
    };

    events.on('refreshDepartmentsUnread', refreshHandler);
    events.on('refreshCalls', refreshHandler);
    events.on('refreshOperators', handleDndStatusChange);

    return () => {
      mounted = false;
      events.off('refreshDepartmentsUnread', refreshHandler);
      events.off('refreshCalls', refreshHandler);
      events.off('refreshOperators', handleDndStatusChange);
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
            className="w-auto"
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
                        <Link href="/app" className="flex justify-between items-center w-full">
                            <div className="flex items-center gap-2">
                                <Inbox />
                                <span>Inbox</span>
                            </div>
                            {inboxUnread > 0 && (
                                <Badge className="h-5">{inboxUnread}</Badge>
                            )}
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
                                        <span className="truncate flex-1">{dept.name}</span>
                                        {dept.is_dnd ? <BellOff className="h-3 w-3 text-amber-600" /> : ''}
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
                                        <span className="truncate">{formatPhoneNumber(item.name)}</span>
                                    </div>
                                     {item.unread_count > 0 && (
                                        <Badge className="h-5">{item.unread_count}</Badge>
                                    )}
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
