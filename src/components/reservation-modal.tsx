'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { Reservation } from "twilio-taskrouter";

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onAccept: (reservation: Reservation) => void;
  onReject: (reservation: Reservation) => void;
}

export default function ReservationModal({ isOpen, onClose, reservation, onAccept, onReject }: ReservationModalProps) {
  if (!reservation) return null;

  const handleAccept = () => {
    onAccept(reservation);
  };

  const handleReject = () => {
    onReject(reservation);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Incoming Reservation</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center">
                    <Phone className="h-10 w-10 text-primary animate-shake" />
                </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{reservation.task.attributes.from}</p>
            <p className="text-muted-foreground">{reservation.task.attributes.callerName || 'Unknown Caller'}</p>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-4">
          <Button variant="destructive" size="lg" onClick={handleReject}>
            <PhoneOff className="mr-2 h-5 w-5" />
            Reject
          </Button>
          <Button variant="default" size="lg" className="bg-green-600 hover:bg-green-700" onClick={handleAccept}>
            <Phone className="mr-2 h-5 w-5" />
            Accept
          </Button>
        </DialogFooter>
        <style jsx>{`
            @keyframes shake {
                0%, 100% { transform: rotate(0deg); }
                10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
                20%, 40%, 60%, 80% { transform: rotate(10deg); }
            }
            .animate-shake {
                animation: shake 1s infinite;
            }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}