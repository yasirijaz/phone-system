
'use client';

import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Hash, Inbox, LayoutGrid, MessageSquare, Users, Building, BellOff, Phone, MoreVertical, LogOut } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getCommunications } from '@/services/callLogService';
import type { Department, Communication, Contact } from '@/types';
import { Badge } from './ui/badge';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getOtherPartyDisplay } from '@/lib/contact-display';
import { cacheGet, cacheSet, cacheInvalidatePrefix, cacheDel } from '@/lib/simpleCache';
import { Button } from './ui/button';
import {
  getDepartmentsSummary,
  invalidateDepartmentsSummaryCache,
  leaveDepartment,
  type DepartmentSummaryItem,
} from '@/services/departmentService';
import { getContacts } from '@/services/contactService';
import { debounce } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

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

const SIDEBAR_CACHE_TTL = 2 * 60_000;
const SIDEBAR_CACHE_VERSION = 'v3';

let badgeCanvas: HTMLCanvasElement | null = null;

function renderBadgeDataUrl(count: number): string | undefined {
  if (typeof document === 'undefined') return undefined;
  if (!badgeCanvas) {
    badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 16;
    badgeCanvas.height = 16;
  }
  const ctx = badgeCanvas.getContext('2d');
  if (!ctx) return undefined;

  const size = 16;
  const label = count > 99 ? '99+' : String(count);
  const fontSize = label.length > 2 ? 7 : label.length > 1 ? 9 : 11;

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + 1);

  return badgeCanvas.toDataURL('image/png');
}

function sidebarCacheKey(userId: number): string {
  return `sidebar:${SIDEBAR_CACHE_VERSION}:${userId}`;
}

function mapSummaryToDepartment(
  row: DepartmentSummaryItem,
  companyId: number
): DepartmentWithUnread {
  return {
    id: row.id,
    name: row.name,
    company_id: companyId,
    workflow_sid: row.workflow_sid ?? undefined,
    unread_count: row.unread.total,
    is_dnd: Boolean(row.is_dnd),
  };
}

export function InAppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<DepartmentWithUnread[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [recentsLoading, setRecentsLoading] = useState(true);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [leaveTarget, setLeaveTarget] = useState<DepartmentWithUnread | null>(null);
  const [leavingDepartment, setLeavingDepartment] = useState(false);
  const inElectron = isElectron();
  const initialLoadRef = useRef<Promise<void> | null>(null);
  const unreadRefreshRef = useRef<Promise<void> | null>(null);
  const departmentsRef = useRef<DepartmentWithUnread[]>([]);

  const handleDepartmentCallClick = (departmentId: number, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    events.emit('openDialer', { departmentId: String(departmentId) });
  };

  const handleDepartmentMessageClick = (departmentId: number, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    events.emit('openMessageDialog', { departmentId: String(departmentId) });
  };

  const handleConfirmLeaveDepartment = async () => {
    if (!leaveTarget || !user?.id) return;

    setLeavingDepartment(true);
    try {
      await leaveDepartment(leaveTarget.id);
      setDepartments((prev) => prev.filter((dept) => dept.id !== leaveTarget.id));
      cacheDel(sidebarCacheKey(user.id));
      cacheDel(`sidebar-dept:${user.id}:${leaveTarget.id}`);
      invalidateDepartmentsSummaryCache();
      cacheInvalidatePrefix('unread-logs:');

      toast({
        title: 'Left department',
        description: `You left ${leaveTarget.name}. An admin must re-add you if you need access again.`,
      });

      if (pathname === `/departments/${leaveTarget.id}` || pathname.startsWith(`/departments/${leaveTarget.id}/`)) {
        router.push('/app');
      }
      setLeaveTarget(null);
    } catch (error: any) {
      toast({
        title: 'Could not leave department',
        description: error?.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLeavingDepartment(false);
    }
  };

  useEffect(() => {
    departmentsRef.current = departments;
  }, [departments]);

  const applySummaryUpdates = useCallback((summaryRows: DepartmentSummaryItem[]) => {
    if (!user?.company_id) return;

    setDepartments((prev) =>
      prev.map((dept) => {
        const row = summaryRows.find((item) => item.id === dept.id);
        if (!row) return dept;

        const updated = mapSummaryToDepartment(row, user.company_id!);
        cacheSet(`sidebar-dept:${user.id}:${dept.id}`, updated, SIDEBAR_CACHE_TTL);
        return updated;
      })
    );

    const cached = cacheGet<{
      departments: DepartmentWithUnread[];
      recentItems: RecentItem[];
      inboxUnread: number;
    }>(`sidebar:${SIDEBAR_CACHE_VERSION}:${user.id}`);
    if (cached) {
      cacheSet(
        sidebarCacheKey(user.id),
        {
          ...cached,
          departments: cached.departments.map((dept) => {
            const row = summaryRows.find((item) => item.id === dept.id);
            return row ? mapSummaryToDepartment(row, user.company_id!) : dept;
          }),
        },
        SIDEBAR_CACHE_TTL
      );
    }
  }, [user?.id, user?.company_id]);

  const sendBadgeCount = useCallback((deptUnread: number, inbox: number) => {
    if (!isElectron() || !window.electronAPI) return;
    try {
      const total = deptUnread + inbox;
      if (total <= 0) {
        window.electronAPI.send('update-badge-count', { count: 0 });
        return;
      }
      const dataUrl = renderBadgeDataUrl(total);
      window.electronAPI.send('update-badge-count', { count: total, dataUrl });
    } catch (_) {}
  }, []);

  const refreshInboxAndRecents = useCallback(async () => {
    if (!user?.id || !user?.company_id) return;

    try {
      const [recentCommsResponse, contacts] = await Promise.all([
        getCommunications({ limit: 50, scope: 'assigned' }),
        getContacts(user.company_id),
      ]);

      const recentComms = Array.isArray(recentCommsResponse.results) ? recentCommsResponse.results : [];
      const newInboxUnread = recentComms.filter((c) => !c.is_read).length;
      setInboxUnread(newInboxUnread);

      const uniqueRecents: { [key: string]: RecentItem } = {};
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

      // Update sidebar cache with fresh inbox/recents data
      const cacheKey = sidebarCacheKey(user.id);
      const cached = cacheGet<{
        departments: DepartmentWithUnread[];
        recentItems: RecentItem[];
        inboxUnread: number;
      }>(cacheKey);
      cacheSet(cacheKey, {
        departments: cached?.departments ?? departmentsRef.current,
        recentItems: recents,
        inboxUnread: newInboxUnread,
      }, SIDEBAR_CACHE_TTL);

      // Update Electron badge
      const deptTotal = departmentsRef.current.reduce((sum, d) => sum + d.unread_count, 0);
      sendBadgeCount(deptTotal, newInboxUnread);
    } catch (e) {
      console.error('Failed to refresh inbox/recents unread counts', e);
    }
  }, [user?.id, user?.company_id, sendBadgeCount]);

  const refreshDepartmentUnreadBadges = useCallback(async (targetDepartmentId?: number) => {
    if (!user?.id) return;

    const currentDepartments = departmentsRef.current;
    if (currentDepartments.length === 0) return;

    if (unreadRefreshRef.current) {
      await unreadRefreshRef.current;
      return;
    }

    const departmentIds = targetDepartmentId
      ? [targetDepartmentId]
      : currentDepartments.map((dept) => dept.id);

    const request = (async () => {
      try {
        invalidateDepartmentsSummaryCache();
        cacheInvalidatePrefix('unread-logs:');
        const summary = await getDepartmentsSummary(departmentIds, { assignedOnly: true });
        applySummaryUpdates(summary.departments);

        // Also update Electron badge after department refresh
        const deptTotal = summary.departments.reduce((sum, d) => sum + (d.unread?.total ?? 0), 0);
        sendBadgeCount(deptTotal, inboxUnread);
      } catch (e) {
        console.error('Failed to refresh department unread badges', e);
      } finally {
        unreadRefreshRef.current = null;
      }
    })();

    unreadRefreshRef.current = request;
    await request;
  }, [user?.id, applySummaryUpdates, inboxUnread, sendBadgeCount]);

  const fetchInitialSidebarData = useCallback(async () => {
    if (!user?.id || !user?.company_id) return;
    const userId = user.id;
    const companyId = user.company_id;

    const cacheKey = sidebarCacheKey(userId);
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

        const [summary, recentCommsResponse, contacts] = await Promise.all([
          getDepartmentsSummary(undefined, { assignedOnly: true }),
          getCommunications({ limit: 50, scope: 'assigned' }),
          getContacts(companyId),
        ]);

        const deptsWithCounts = summary.departments.map((row) => {
          const mapped = mapSummaryToDepartment(row, companyId);
          cacheSet(`sidebar-dept:${userId}:${row.id}`, mapped, SIDEBAR_CACHE_TTL);
          return mapped;
        });

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

        const deptTotal = deptsWithCounts.reduce((sum, d) => sum + d.unread_count, 0);
        sendBadgeCount(deptTotal, inboxUnreadCount);
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
  }, [user, sendBadgeCount]);

  useEffect(() => {
    if (!user) return;

    fetchInitialSidebarData();

    const handleUnreadRefresh = () => {
      void refreshDepartmentUnreadBadges();
      void refreshInboxAndRecents();
    };

    const debouncedInboxRefresh = debounce(() => {
      cacheDel(sidebarCacheKey(user.id));
      void refreshInboxAndRecents();
    }, 1500);

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

    events.on('refreshDepartmentsUnread', handleUnreadRefresh);
    events.on('refreshCalls', debouncedInboxRefresh);
    events.on('refreshOperators', handleDndStatusChange);

    return () => {
      events.off('refreshDepartmentsUnread', handleUnreadRefresh);
      events.off('refreshCalls', debouncedInboxRefresh);
      events.off('refreshOperators', handleDndStatusChange);
    };
  }, [user, fetchInitialSidebarData, refreshDepartmentUnreadBadges, refreshInboxAndRecents]);

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
                        <SidebarMenuItem key={dept.id} className="group/dept relative">
                              <SidebarMenuButton
                                asChild
                                isActive={pathname === `/departments/${dept.id}`}
                                className="!pr-2 group-hover/dept:!pr-[5.5rem] group-focus-within/dept:!pr-[5.5rem]"
                              >
                                  <Link href={`/departments/${dept.id}`} className="flex min-w-0 items-center gap-2 overflow-hidden">
                                      <Building className="h-4 w-4 shrink-0" />
                                      <span className="min-w-0 flex-1 truncate" title={dept.name}>
                                        {dept.name}
                                      </span>
                                      {dept.is_dnd ? (
                                        <BellOff className="h-3 w-3 shrink-0 text-amber-600" />
                                      ) : null}
                                      {dept.unread_count > 0 ? (
                                          <Badge className="h-5 max-w-[3rem] shrink-0 truncate tabular-nums group-hover/dept:invisible group-focus-within/dept:invisible">
                                            {dept.unread_count}
                                          </Badge>
                                      ) : null}
                                  </Link>
                              </SidebarMenuButton>
                              <div className="absolute inset-y-0 right-1 z-20 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/dept:opacity-100 group-focus-within/dept:opacity-100">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 bg-sidebar hover:bg-accent"
                                  aria-label={`Call from ${dept.name}`}
                                  onClick={(event) => handleDepartmentCallClick(dept.id, event)}
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 bg-sidebar hover:bg-accent"
                                  aria-label={`Message from ${dept.name}`}
                                  onClick={(event) => handleDepartmentMessageClick(dept.id, event)}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 bg-sidebar hover:bg-accent data-[state=open]:bg-accent"
                                      aria-label={`More options for ${dept.name}`}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                      }}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setLeaveTarget(dept)}
                                    >
                                      <LogOut className="mr-2 h-4 w-4" />
                                      Leave department
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
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

      <AlertDialog
        open={Boolean(leaveTarget)}
        onOpenChange={(open) => {
          if (!open && !leavingDepartment) setLeaveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone by you. After you leave, you will lose access to this
              department and will need an admin to add you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leavingDepartment}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={leavingDepartment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmLeaveDepartment();
              }}
            >
              {leavingDepartment ? 'Leaving...' : 'Leave department'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
