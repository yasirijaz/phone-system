
'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOutgoing, Delete } from "lucide-react";

interface DialerProps {
    onMakeCall: (number: string) => void;
}

export default function Dialer({ onMakeCall }: DialerProps) {
    const [number, setNumber] = useState('');

    const handleDigitClick = (digit: string) => {
        setNumber(prev => prev + digit);
    };

    const handleBackspace = () => {
        setNumber(prev => prev.slice(0, -1));
    };

    const handleCall = () => {
        if (number) {
            onMakeCall(number);
        }
    };
    
    const dialpadKeys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '*', '0', '#'
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                    <PhoneOutgoing className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Dialer</h4>
                        <p className="text-sm text-muted-foreground">
                            Enter a number to make an outgoing call.
                        </p>
                    </div>
                    <div className="relative">
                        <Input 
                            value={number} 
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="(123) 456-7890"
                            className="text-center text-lg pr-8"
                        />
                         {number.length > 0 && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleBackspace}>
                                <Delete className="h-4 w-4"/>
                            </Button>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {dialpadKeys.map(key => (
                             <Button key={key} variant="outline" className="h-14 text-xl" onClick={() => handleDigitClick(key)}>
                                {key}
                             </Button>
                        ))}
                    </div>
                    <Button onClick={handleCall} disabled={!number} className="bg-green-600 hover:bg-green-700">
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
