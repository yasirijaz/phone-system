
'use client';

import { useState, type ReactNode, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Delete } from "lucide-react";
import type { Department, PhoneNumber } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface DialerProps {
    onMakeCall: (number: string, fromNumber?: string) => void;
    children: ReactNode;
    departments: Department[];
    phoneNumbers: PhoneNumber[];
    onDepartmentChange: (departmentId: string) => void;
    loadingDepartments: boolean;
    loadingNumbers: boolean;
}

export default function Dialer({ 
    onMakeCall, 
    children, 
    departments,
    phoneNumbers,
    onDepartmentChange,
    loadingDepartments,
    loadingNumbers,
}: DialerProps) {
    const [number, setNumber] = useState('');
    const [fromNumber, setFromNumber] = useState('');
    const [departmentId, setDepartmentId] = useState('');

    const handleDigitClick = (digit: string) => {
        setNumber(prev => prev + digit);
    };

    const handleBackspace = () => {
        setNumber(prev => prev.slice(0, -1));
    };

    const handleCall = () => {
        if (number) {
            onMakeCall(number, fromNumber);
        }
    };

    const handleDepartmentSelection = (id: string) => {
        setDepartmentId(id);
        setFromNumber('');
        onDepartmentChange(id);
    }
    
    const dialpadKeys = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '*', '0', '#'
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Dialer</h4>
                        <p className="text-sm text-muted-foreground">
                            Enter a number to make an outgoing call.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <Select onValueChange={handleDepartmentSelection} value={departmentId} disabled={loadingDepartments}>
                            <SelectTrigger variant="ghost">
                                <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select Dept."} />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(dept => (
                                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Select onValueChange={setFromNumber} value={fromNumber} disabled={loadingNumbers || !departmentId}>
                            <SelectTrigger variant="ghost">
                                <SelectValue placeholder={loadingNumbers ? "Loading..." : "From Number"} />
                            </SelectTrigger>
                            <SelectContent>
                                {phoneNumbers.map(num => (
                                    <SelectItem key={num.id} value={num.phone_no}>{num.phone_no}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                    <Button onClick={handleCall} disabled={!number || !fromNumber} className="bg-green-600 hover:bg-green-700">
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
