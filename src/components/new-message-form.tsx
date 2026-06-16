
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Department, PhoneNumber, Contact } from '@/types';
import { Button } from './ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { getPhoneNumberOptionLabel } from '@/lib/utils';


interface NewMessageFormProps {
    onClose: () => void;
    departments: Department[];
    phoneNumbers: PhoneNumber[];
    onDepartmentChange: (departmentId: string) => void;
    loadingDepartments: boolean;
    loadingNumbers: boolean;
    selectedDepartmentId: string;
    selectedFromNumber: string;
    onSetSelectedFromNumber: (fromNumber: string) => void;
    contacts: Contact[];
}

const messageSchema = z.object({
    recipient: z.string().min(1, "Recipient number is required."),
    departmentId: z.string().min(1, "Please select a department."),
    fromNumber: z.string().min(1, "Please select a number to send from."),
    message: z.string().min(1, "Message cannot be empty."),
});


export default function NewMessageForm({ 
    onClose, 
    departments, 
    phoneNumbers, 
    onDepartmentChange,
    loadingDepartments,
    loadingNumbers,
    selectedDepartmentId,
    selectedFromNumber,
    onSetSelectedFromNumber,
    contacts = []
}: NewMessageFormProps) {
    const { toast } = useToast();
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    
    const form = useForm<z.infer<typeof messageSchema>>({
        resolver: zodResolver(messageSchema),
        defaultValues: { recipient: "", departmentId: "", fromNumber: "", message: "" }
    });
    
    useEffect(() => {
        form.setValue("departmentId", selectedDepartmentId);
        form.setValue("fromNumber", selectedFromNumber);
    }, [selectedDepartmentId, selectedFromNumber, form]);

    const watchedDepartmentId = form.watch("departmentId");

    useEffect(() => {
        if (watchedDepartmentId && watchedDepartmentId !== selectedDepartmentId) {
            onDepartmentChange(watchedDepartmentId);
            form.setValue("fromNumber", ""); // Reset from number when department changes
        }
    }, [watchedDepartmentId, onDepartmentChange, selectedDepartmentId, form]);

    const watchedFromNumber = form.watch("fromNumber");
    const watchedRecipient = form.watch("recipient");

    useEffect(() => {
        if(watchedFromNumber !== selectedFromNumber) {
            onSetSelectedFromNumber(watchedFromNumber);
        }
    }, [watchedFromNumber, selectedFromNumber, onSetSelectedFromNumber]);

    useEffect(() => {
        if (watchedRecipient.length > 2) {
            const searchTerm = watchedRecipient.toLowerCase();
            const matchingContacts = contacts.filter(contact => 
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.phone_no.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
            );
            setFilteredContacts(matchingContacts);
        } else {
            setFilteredContacts([]);
        }
    }, [watchedRecipient, contacts]);

    const handleContactSelect = (contact: Contact) => {
        form.setValue("recipient", contact.phone_no);
        setFilteredContacts([]);
    };
    
    const onSubmit = (values: z.infer<typeof messageSchema>) => {
        console.log(values);
        toast({ title: "Message Sent (simulation)", description: `Message to ${values.recipient} is on its way!` });
        onClose();
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                 <FormField control={form.control} name="recipient" render={({ field }) => (
                    <FormItem>
                        <FormLabel>To</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input placeholder="Enter recipient's phone number or name" {...field} />
                                 {filteredContacts.length > 0 && (
                                    <div className="absolute z-10 w-full bg-background border rounded-md mt-1 max-h-48 overflow-y-auto">
                                        <ScrollArea className="h-full">
                                        {filteredContacts.map(contact => (
                                            <div key={contact.id} onClick={() => handleContactSelect(contact)} className="p-2 hover:bg-accent cursor-pointer">
                                                <p className="font-semibold">{contact.name}</p>
                                                <p className="text-sm text-muted-foreground">{contact.phone_no}</p>
                                            </div>
                                        ))}
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="departmentId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>From Department</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value} disabled={loadingDepartments}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingDepartments ? "Loading..." : "Select Dept."} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="fromNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>From Number</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value} disabled={loadingNumbers}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingNumbers ? "Loading..." : "Select Number"} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {phoneNumbers.map(num => (
                                        <SelectItem key={num.id} value={num.phone_no}>{getPhoneNumberOptionLabel(num)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                 <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl><Textarea placeholder="Type your message here..." rows={5} {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit">
                         Send Message
                    </Button>
                </div>
            </form>
        </Form>
    )

}
