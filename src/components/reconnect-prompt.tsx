
'use client';

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PhoneForwarded, X } from 'lucide-react';

interface ReconnectPromptProps {
    onReconnect: () => void;
    onDismiss: () => void;
}

export default function ReconnectPrompt({ onReconnect, onDismiss }: ReconnectPromptProps) {
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
            <Alert>
                <PhoneForwarded className="h-4 w-4" />
                <AlertTitle>You have a call in progress!</AlertTitle>
                <AlertDescription className="flex items-center justify-between mt-2">
                    Would you like to reconnect?
                    <div className="flex gap-2">
                        <Button onClick={onReconnect} size="sm">Reconnect</Button>
                        <Button onClick={onDismiss} size="sm" variant="outline">Dismiss</Button>
                    </div>
                </AlertDescription>
            </Alert>
        </div>
    );
}
