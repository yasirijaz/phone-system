'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  
  const callerName = reservation.task.attributes.callerName || 'Unknown Caller';
  const callerNumber = reservation.task.attributes.from || '';


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-gray-700 text-white border-0 w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col justify-between p-8" 
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <div className="text-center pt-8">
          <p className="text-lg text-neutral-400">Incoming Reservation</p>
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
                    onClick={handleReject}
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
                    onClick={handleAccept}
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
