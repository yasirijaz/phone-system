
'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface IncomingCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  callerNumber: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ isOpen, onClose, callerName, callerNumber, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-black text-white border-0 w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col justify-between p-8" 
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <div className="text-center pt-8">
          <p className="text-lg text-neutral-400">incoming call</p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4 my-8">
           <div className="relative flex items-center justify-center w-40 h-40">
                <div className="absolute w-full h-full rounded-full bg-green-500/10 animate-pulse-slow"></div>
                <div className="absolute w-3/4 h-3/4 rounded-full bg-green-500/20 animate-pulse-medium"></div>
                <div className="w-1/2 h-1/2 rounded-full bg-green-500 flex items-center justify-center">
                    <Phone className="h-10 w-10 text-white animate-shake" />
                </div>
            </div>
          <div className="text-center mt-4">
            <p className="text-3xl font-bold">{callerName}</p>
            <p className="text-neutral-300">{callerNumber}</p>
          </div>
        </div>

        <div className="flex justify-around items-center w-full pb-8">
            <div className="flex flex-col items-center gap-2">
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="rounded-full h-16 w-16 bg-red-600 hover:bg-red-700"
                    onClick={onReject}
                >
                    <PhoneOff className="h-8 w-8" />
                </Button>
                <span className="text-sm text-neutral-400">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                 <Button 
                    variant="default" 
                    size="icon" 
                    className="rounded-full h-16 w-16 bg-green-600 hover:bg-green-700"
                    onClick={onAccept}
                >
                    <Phone className="h-8 w-8" />
                </Button>
                 <span className="text-sm text-neutral-400">Accept</span>
            </div>
        </div>

        <style jsx>{`
            @keyframes shake {
                0%, 100% { transform: rotate(0deg); }
                10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
                20%, 40%, 60%, 80% { transform: rotate(10deg); }
            }
            .animate-shake {
                animation: shake 1s infinite;
            }
             @keyframes pulse-slow {
                0%, 100% { opacity: 0.5; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1); }
            }
            .animate-pulse-slow {
                animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes pulse-medium {
                0%, 100% { opacity: 0.5; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1); }
            }
            .animate-pulse-medium {
                animation: pulse-medium 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                animation-delay: 0.2s;
            }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// Custom close button property for DialogContent
declare module "@radix-ui/react-dialog" {
    interface DialogContentProps {
        hideCloseButton?: boolean;
    }
}
const OriginalDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {hideCloseButton?: boolean}
// @ts-ignore
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
        className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
OriginalDialogContent.displayName = DialogPrimitive.Content.displayName;

// @ts-ignore
import * as DialogPrimitive from "@radix-ui/react-dialog";
// @ts-ignore
DialogContent.render = OriginalDialogContent.render;

