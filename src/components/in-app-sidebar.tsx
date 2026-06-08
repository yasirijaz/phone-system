
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Hash, Inbox, LayoutGrid, MessageSquare, Users, Building, BellOff } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getUserDepartments } from '@/services/userService';
import { getCommunications, getUnreadCallLogs } from '@/services/callLogService';
import { getDndStatus } from '@/services/departmentService';
import type { Department, Communication, Contact } from '@/types';
import { Badge } from './ui/badge';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getContacts } from '@/services/contactService';
import { debounce } from '@/lib/utils';
import { getOtherPartyDisplay } from '@/lib/contact-display';
import { cacheGet, cacheSet } from '@/lib/simpleCache';

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

const SIDEBAR_CACHE_TTL = 30_000;
const UNREAD_REFRESH_DEBOUNCE_MS = 1_500;

export function InAppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithUnread[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [recentsLoading, setRecentsLoading] = useState(true);
  const [inboxUnread, setInboxUnread] = useState(0);
  const inElectron = isElectron();
  const initialLoadRef = useRef<Promise<void> | null>(null);
  const unreadRefreshRef = useRef<Promise<void> | null>(null);
  const departmentsRef = useRef<DepartmentWithUnread[]>([]);

  useEffect(() => {
    departmentsRef.current = departments;
  }, [departments]);

  const refreshDepartmentUnreadBadges = useCallback(async (targetDepartmentId?: number) => {
    if (!user?.id) return;

    const currentDepartments = departmentsRef.current;
    if (currentDepartments.length === 0) return;

    if (unreadRefreshRef.current) {
      await unreadRefreshRef.current;
      return;
    }

    const departmentsToUpdate = targetDepartmentId
      ? currentDepartments.filter((dept) => dept.id === targetDepartmentId)
      : currentDepartments;

    if (departmentsToUpdate.length === 0) return;

    const request = (async () => {
      try {
        const updates = await Promise.all(
          departmentsToUpdate.map(async (dept) => {
            try {
              const unreadLogs = await getUnreadCallLogs(dept.id);
              const unreadCount = Array.isArray(unreadLogs) ? unreadLogs.length : 0;
              const updated = { ...dept, unread_count: unreadCount };
              cacheSet(`sidebar-dept:${user.id}:${dept.id}`, updated, SIDEBAR_CACHE_TTL);
              return { id: dept.id, unread_count: unreadCount };
            } catch (e) {
              console.error(`Failed to refresh unread count for department ${dept.id}`, e);
              return { id: dept.id, unread_count: dept.unread_count };
            }
          })
        );

        setDepartments((prev) =>
          prev.map((dept) => {
            const update = updates.find((item) => item.id === dept.id);
            return update ? { ...dept, unread_count: update.unread_count } : dept;
          })
        );

        const cached = cacheGet<{
          departments: DepartmentWithUnread[];
          recentItems: RecentItem[];
          inboxUnread: number;
        }>(`sidebar:${user.id}`);
        if (cached) {
          cacheSet(
            `sidebar:${user.id}`,
            {
              ...cached,
              departments: cached.departments.map((dept) => {
                const update = updates.find((item) => item.id === dept.id);
                return update ? { ...dept, unread_count: update.unread_count } : dept;
              }),
            },
            SIDEBAR_CACHE_TTL
          );
        }
      } finally {
        unreadRefreshRef.current = null;
      }
    })();

    unreadRefreshRef.current = request;
    await request;
  }, [user?.id]);

  const fetchInitialSidebarData = useCallback(async () => {
    if (!user?.id || !user?.company_id) return;

    const cacheKey = `sidebar:${user.id}`;
    const cached = cacheGet<{
      departments: DepartmentWithUnread[];
      recentItems: RecentItem[];
      inboxUnread: number;
    }>(cacheKey);
    if (cached) {
      setDepartments(cached.departments);
      setRecentItems(cached.recentItems);
      setInboxUnread(cached.inboxUnread);
      setDepartmentsLoading(false);
      setRecentsLoading(false);
      return;
    }

    if (initialLoadRef.current) {
      await initialLoadRef.current;
      return;
    }

    const request = (async () => {
      try {
        setDepartmentsLoading(true);
        setRecentsLoading(true);

        const [userDepts, recentCommsResponse, contacts] = await Promise.all([
          getUserDepartments(user.id),
          getCommunications({ limit: 50 }),
          getContacts(user.company_id),
        ]);

        const deptsArray = Array.isArray(userDepts) ? userDepts : [];

        const deptsWithCounts = await Promise.all(
          deptsArray.map(async (dept) => {
            try {
              const deptCacheKey = `sidebar-dept:${user.id}:${dept.id}`;
              const cachedDept = cacheGet<DepartmentWithUnread>(deptCacheKey);
              if (cachedDept) return cachedDept;

              const [unreadLogs, dnd] = await Promise.all([
                getUnreadCallLogs(dept.id),
                getDndStatus(dept.id, user.id),
              ]);
              const unreadCount = Array.isArray(unreadLogs) ? unreadLogs.length : 0;
              const result = { ...dept, unread_count: unreadCount, is_dnd: dnd.is_dnd };
              cacheSet(deptCacheKey, result, SIDEBAR_CACHE_TTL);
              return result;
            } catch (e) {
              console.error(`Failed to get data for department ${dept.id}`, e);
              return { ...dept, unread_count: 0, is_dnd: false };
            }
          })
        );

        setDepartments(deptsWithCounts);

        const recentComms = Array.isArray(recentCommsResponse.results) ? recentCommsResponse.results : [];
        const uniqueRecents: { [key: string]: RecentItem } = {};
        const inboxUnreadCount = recentComms.filter((c) => !c.is_read).length;
        setInboxUnread(inboxUnreadCount);

        recentComms.forEach((comm: Communication) => {
          const otherPartyNumber = comm.direction === 'inbound' ? comm.from : comm.to;
          const fromNumber = comm.direction === 'inbound' ? comm.to : comm.from;

          if (!uniqueRecents[otherPartyNumber]) {
            const contact = contacts
              ? contacts.find((c: Contact) => c.phone_no === otherPartyNumber)
              : null;
            const display = getOtherPartyDisplay(comm, contact);
            uniqueRecents[otherPartyNumber] = {
              id: otherPartyNumber,
              name: display.displayName,
              href: `/conversations/${encodeURIComponent(fromNumber)}/${encodeURIComponent(otherPartyNumber)}`,
              initials: display.initial,
              unread_count: 0,
            };
          }
        });

        Object.keys(uniqueRecents).forEach((number) => {
          const unreadCount = recentComms.filter(
            (c) => (c.direction === 'inbound' ? c.from : c.to) === number && !c.is_read
          ).length;
          uniqueRecents[number].unread_count = unreadCount;
        });

        const recents = Object.values(uniqueRecents).slice(0, 10);
        setRecentItems(recents);

        cacheSet(cacheKey, {
          departments: deptsWithCounts,
          recentItems: recents,
          inboxUnread: inboxUnreadCount,
        }, SIDEBAR_CACHE_TTL);
      } catch (error) {
        console.error('Failed to fetch sidebar data', error);
        setDepartments([]);
        setRecentItems([]);
      } finally {
        setDepartmentsLoading(false);
        setRecentsLoading(false);
        initialLoadRef.current = null;
      }
    })();

    initialLoadRef.current = request;
    await request;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchInitialSidebarData();

    const debouncedUnreadRefresh = debounce(() => {
      refreshDepartmentUnreadBadges();
    }, UNREAD_REFRESH_DEBOUNCE_MS);

    const handleDndStatusChange = (data: { department_id?: number; is_dnd?: boolean }) => {
      if (data?.department_id == null || data?.is_dnd === undefined) return;

      setDepartments((prevDepartments) =>
        prevDepartments.map((dept) =>
          dept.id === data.department_id
            ? { ...dept, is_dnd: Boolean(data.is_dnd) }
            : dept
        )
      );
    };

    // Only refresh unread badges when the user reads something — not on every socket call event.
    events.on('refreshDepartmentsUnread', debouncedUnreadRefresh);
    events.on('refreshOperators', handleDndStatusChange);

    return () => {
      events.off('refreshDepartmentsUnread', debouncedUnreadRefresh);
      events.off('refreshOperators', handleDndStatusChange);
    };
  }, [user, fetchInitialSidebarData, refreshDepartmentUnreadBadges]);

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
                {departmentsLoading ? (
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
                 {recentsLoading ? (
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
