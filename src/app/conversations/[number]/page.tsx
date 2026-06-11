
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from 'next/navigation';
import { getCommunicationThread, markThreadAsRead } from "@/services/callLogService";
import type { Communication, Department, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import CallLog from "@/components/call-log";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTwilio } from "@/context/TwilioContext";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";
import { events } from "@/lib/events";
import { cacheGet, cacheSet } from "@/lib/simpleCache";
import { formatPhoneNumber } from "@/lib/utils";
import { getOtherPartyDisplay } from "@/lib/contact-display";

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const { device, isDeviceReady } = useTwilio();

    const [allComms, setAllComms] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');
    const [contactSublabel, setContactSublabel] = useState<string | null>(null);
    const inFlightRef = useRef<Map<string, Promise<Communication[]>>>(new Map());
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from = '', to = ''] = slug.map(part => decodeURIComponent(part));

    const refreshThread = useCallback(async (): Promise<Communication[]> => {
        try {
            const cacheKey = `thread:${from}:${to}`;
            const cached = cacheGet<Communication[]>(cacheKey);
            let logs: Communication[];
            if (cached) {
                logs = cached;
            } else {
                let inFlight = inFlightRef.current.get(cacheKey);
                if (!inFlight) {
                    inFlight = getCommunicationThread(from, to);
                    inFlightRef.current.set(cacheKey, inFlight);
                }
                logs = await inFlight.finally(() => {
                    inFlightRef.current.delete(cacheKey);
                });
                cacheSet(cacheKey, logs, 10_000);
            }
            const sortedLogs = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setAllComms(sortedLogs);
            return sortedLogs;
        } catch (error) {
            console.error("Failed to fetch communication logs", error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        const fetchAndFilterComms = async () => {
            if (!user || !from || !to) return;
            setLoading(true);
            try {
                const logs = await refreshThread();
                const latest = logs[0];
                if (latest) {
                    const display = getOtherPartyDisplay(latest);
                    setContactName(display.displayName);
                    setContactSublabel(display.sublabel);
                } else {
                    setContactName(formatPhoneNumber(to));
                    setContactSublabel(null);
                }

                const hasUnread = logs.some((l: any) => l?.is_read === 0 || l?.is_read === false);
                if (hasUnread) {
                    await markThreadAsRead(from, to);
                    try { events.emit('refreshDepartmentsUnread'); } catch (_) {}
                }

            } catch (error) {
                console.error("Failed to fetch communication logs", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndFilterComms();
        // only when params or user change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, from, to]);

    useEffect(() => {
        const handler = (payload: { from: string; to: string }) => {
            const matches = (payload.from === from && payload.to === to) || (payload.from === to && payload.to === from);
            if (matches) {
                refreshThread();
            }
        };
        events.on('refreshConversation', handler);
        return () => {
            events.off('refreshConversation', handler);
        };
    }, [from, to, refreshThread]);

    const handleMakeCall = async (number: string) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
            return;
        }
        console.log("Request to call from conversation detail:", number);
    };

    return (
                <div className="flex h-screen w-full bg-background text-foreground">
                    <div className="flex flex-1 flex-col">
                         <AppHeader user={user} logout={logout} />
                         <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                    <ArrowLeft />
                                </Button>
                                <div className="relative flex-1">
                                    <h1 className="text-xl font-bold">{contactName}</h1>
                                    {contactSublabel && (
                                      <p className="text-sm text-muted-foreground">{contactSublabel}</p>
                                    )}
                                </div>
                            </div>
                        </header>
                         <main className="flex-1 overflow-y-auto p-6">
                           {loading ? <p>Loading...</p> : <CallLog calls={allComms} onMakeCall={handleMakeCall} isClickable={false} />}
                        </main>
                        <footer className="p-4 border-t bg-background space-y-2">
                             <div className="grid grid-cols-2 gap-2">
                                 <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales">Sales</SelectItem>
                                        <SelectItem value="support">Support</SelectItem>
                                        <SelectItem value="personal">Personal</SelectItem>
                                    </SelectContent>
                                </Select>
                                 <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="template1">Template 1</SelectItem>
                                        <SelectItem value="template2">Template 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative">
                                <Textarea 
                                    placeholder="Write Your Message..."
                                    className="pr-10"
                                />
                                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <Send className="h-5 w-5"/>
                                </Button>
                            </div>
                        </footer>
                    </div>
                </div>
    );
}
