
"use client";

import { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DownloadCloud, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface UpdateProgressProps {
    message: string;
}

export default function UpdateProgress({ message }: UpdateProgressProps) {
    const [status, setStatus] = useState<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error' | 'not-available'>('idle');
    const [progress, setProgress] = useState(0);
    const [version, setVersion] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!message) {
            setStatus('idle');
            return;
        }

        if (message.startsWith('Checking for updates...')) {
            setStatus('checking');
            toast({
                title: 'Checking for Updates',
                description: 'Please wait while we check for the latest version.',
            });
        } else if (message.startsWith('Update available:')) {
            const versionMatch = message.match(/&&([\d.]+)/);
            if (versionMatch) {
                setVersion(versionMatch[1]);
            }
            toast({
                title: 'Update Available',
                description: versionMatch ? `Version v${versionMatch[1]} found. Starting download...` : 'A new version is available. Starting download...',
            });
        } else if (message.startsWith('Download progress:')) {
            const progressMatch = message.match(/(\d+\.?\d*)/);
            if (progressMatch) {
                setStatus('downloading');
                setProgress(parseFloat(progressMatch[1]));
            }
        } else if (message.startsWith('Update downloaded;')) {
            setStatus('downloaded');
            toast({
                title: 'Update Ready',
                description: 'The application will restart to install the update shortly.',
            });
        } else if (message.startsWith('Updater error:')) {
            setStatus('error');
            const detail = message.replace('Updater error:', '').trim();
            toast({
                title: 'Update Error',
                description: detail || 'Something went wrong. Please try again later.',
                variant: 'destructive',
            });
        } else if (message.startsWith('No updates available')) {
            setStatus('not-available');
            toast({
                title: 'Up to Date',
                description: 'You are running the latest version.',
            });
            setTimeout(() => setStatus('idle'), 3000);
        } else if (message.startsWith('Skipping auto-update in development')) {
            setStatus('idle');
            toast({
                title: 'Auto-update Disabled',
                description: 'Skipping auto-update in development.',
            });
        } else if (message.startsWith('checkForUpdates failed:')) {
            setStatus('error');
            const detail = message.replace('checkForUpdates failed:', '').trim();
            toast({
                title: 'Update Check Failed',
                description: detail || 'Unable to check for updates.',
                variant: 'destructive',
            });
        }

    }, [message, toast]);

    // Only show the alert UI while actively downloading; use toasts for all others
    if (status !== 'downloading') return null;

    const renderContent = () => {
        switch (status) {
            case 'downloading':
                 return {
                    icon: <DownloadCloud className="h-4 w-4" />,
                    title: `Downloading Update ${version ? `v${version}` : ''}`,
                    description: <Progress value={progress} className="mt-2" />,
                };
            default:
                return null;
        }
    };
    
    const content = renderContent();
    
    if (!content) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm">
            <Alert>
                {content.icon}
                <AlertTitle>{content.title}</AlertTitle>
                <AlertDescription>
                    {content.description}
                </AlertDescription>
            </Alert>
        </div>
    );
}

