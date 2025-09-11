
"use client";

import { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DownloadCloud, CheckCircle, XCircle } from 'lucide-react';

interface UpdateProgressProps {
    message: string;
}

export default function UpdateProgress({ message }: UpdateProgressProps) {
    const [status, setStatus] = useState<'idle' | 'checking' | 'downloading' | 'downloaded' | 'error' | 'not-available'>('idle');
    const [progress, setProgress] = useState(0);
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        if (!message) {
            setStatus('idle');
            return;
        };

        if (message.startsWith('Checking for updates...')) {
            setStatus('checking');
        } else if (message.startsWith('Update available:')) {
            const versionMatch = message.match(/&&([\d.]+)/);
            if(versionMatch) {
                setVersion(versionMatch[1]);
            }
        } else if (message.startsWith('Download progress:')) {
            const progressMatch = message.match(/(\d+\.?\d*)/);
            if (progressMatch) {
                setStatus('downloading');
                setProgress(parseFloat(progressMatch[1]));
            }
        } else if (message.startsWith('Update downloaded;')) {
            setStatus('downloaded');
        } else if (message.startsWith('Updater error:')) {
            setStatus('error');
        } else if (message.startsWith('No updates available')) {
            setStatus('not-available');
             setTimeout(() => setStatus('idle'), 3000);
        }

    }, [message]);

    if (status === 'idle') {
        return null;
    }

    const renderContent = () => {
        switch (status) {
            case 'checking':
                return {
                    icon: <DownloadCloud className="h-4 w-4" />,
                    title: 'Checking for Updates',
                    description: 'Please wait while we check for the latest version.'
                };
            case 'downloading':
                 return {
                    icon: <DownloadCloud className="h-4 w-4" />,
                    title: `Downloading Update ${version ? `v${version}` : ''}`,
                    description: <Progress value={progress} className="mt-2" />,
                };
            case 'downloaded':
                 return {
                    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
                    title: 'Update Ready',
                    description: 'The application will restart to install the update shortly.',
                };
            case 'error':
                 return {
                    icon: <XCircle className="h-4 w-4 text-destructive" />,
                    title: 'Update Error',
                    description: 'Something went wrong. Please try again later.',
                };
            case 'not-available':
                 return {
                    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
                    title: 'Up to Date',
                    description: 'You are running the latest version.',
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

