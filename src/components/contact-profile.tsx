

"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ChevronDown, PlusCircle, Trash2, User, PanelRightOpen, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { createContact, updateContact, blockContact, unblockContact } from '@/services/contactService';
import type { Contact } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';

interface ContactProfileProps {
    contact: any;
    onContactUpdate: () => void;
    onCollapse: () => void;
}

const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone_no: z.string().min(10, "Phone number is required."),
  phone_type: z.string().min(1, "Phone type is required."),
});

type BlockOption = 'voicemail' | 'spam' | 'hard';

export default function ContactProfile({ contact, onContactUpdate, onCollapse }: ContactProfileProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
    const [selectedBlockOption, setSelectedBlockOption] = useState<BlockOption>('voicemail');

    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: "",
            email: "",
            phone_no: "",
            phone_type: "mobile",
        }
    });

    const isSavedContact = !!contact?.id;

    useEffect(() => {
        if (contact) {
            form.reset({
                name: isSavedContact ? contact.name : '',
                email: contact.email || '',
                phone_no: contact.phone_no || '',
                phone_type: contact.phone_type || 'mobile',
            });
        }
    }, [contact, form, isSavedContact]);
    
    const handleAddClick = () => {
        form.reset({
            name: '',
            email: '',
            phone_no: contact.phone_no,
            phone_type: 'mobile',
        });
        setIsEditing(true);
    };
    
    if (!contact) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Select a conversation to see details.</p>
            </div>
        );
    }
    
    const contactInitial = contact.name ? contact.name.charAt(0).toUpperCase() : '?';

    const handleFormSubmit = async (values: z.infer<typeof contactSchema>) => {
        if (!user?.company_id) return;
        try {
            if (isSavedContact) {
                await updateContact(contact.id, { ...values, company_id: user.company_id });
                toast({ title: 'Success', description: 'Contact updated.' });
            } else {
                await createContact({ ...values, company_id: user.company_id });
                toast({ title: 'Success', description: 'Contact created.' });
            }
            onContactUpdate();
            setIsEditing(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save contact.', variant: 'destructive' });
        }
    };
    
    const handleBlock = async () => {
        if (!isSavedContact) return;
        try {
            await blockContact(contact.id, selectedBlockOption);
            toast({ title: 'Success', description: `Contact has been blocked.` });
            onContactUpdate();
            setIsBlockDialogOpen(false);
        } catch (error: any) {
             toast({ title: 'Error', description: error.response?.data?.message || `Failed to block contact.`, variant: 'destructive' });
        }
    };
    
    const handleUnblock = async () => {
        if (!isSavedContact) return;
        try {
            await unblockContact(contact.id);
            toast({ title: 'Success', description: 'Contact has been unblocked.' });
            onContactUpdate();
        } catch (error: any) {
             toast({ title: 'Error', description: error.response?.data?.message || `Failed to unblock contact.`, variant: 'destructive' });
        }
    };

    return (
        <div className="h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold text-lg">Profile</h2>
                <Button variant="ghost" size="icon" onClick={onCollapse}>
                    <PanelRightOpen className="h-5 w-5" />
                </Button>
            </header>
            <div className="flex-1 p-4 space-y-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 text-xl">
                        <AvatarFallback>{contactInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex items-center justify-between">
                         <h3 className="text-xl font-bold">{contact.name}</h3>
                         <Button variant="ghost" size="icon"><ChevronDown className="h-5 w-5" /></Button>
                    </div>
                </div>

                <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{contact.phone_type || 'Other'}</span>
                        <span>{contact.phone_no}</span>
                    </div>
                     <div className="flex justify-between gap-2">
                        <Dialog open={isEditing} onOpenChange={setIsEditing}>
                            <DialogTrigger asChild>
                                {isSavedContact ? (
                                    <Button variant="outline" className="w-full" onClick={() => setIsEditing(true)}>Edit contact</Button>
                                ) : (
                                     <Button className="w-full" onClick={handleAddClick}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add contact
                                    </Button>
                                )}
                            </DialogTrigger>
                             <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{isSavedContact ? 'Edit' : 'Add'} Contact</DialogTitle>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                                        <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g. john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="phone_no" render={({ field }) => (
                                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1234567890" {...field}  /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                        <FormField control={form.control} name="phone_type" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="mobile">Mobile</SelectItem>
                                                <SelectItem value="work">Work</SelectItem>
                                                <SelectItem value="home">Home</SelectItem>
                                            </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                        )}/>
                                        <DialogFooter>
                                            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                                            <Button type="submit">Save Contact</Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                         {isSavedContact && (
                             contact.is_block ? (
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full">Unblock Contact</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will allow the contact to call and message you again.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleUnblock}>Unblock</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             ) : (
                                <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" className="w-full">Block Contact</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>BLOCK {contact.phone_no}</DialogTitle>
                                            <DialogDescription>
                                                This will prevent this number from calling you or sending you messages.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <RadioGroup value={selectedBlockOption} onValueChange={(value: BlockOption) => setSelectedBlockOption(value)} className="space-y-4 py-4">
                                            <Label className="flex items-start gap-4 p-4 rounded-md border has-[:checked]:border-primary">
                                                <RadioGroupItem value="voicemail" />
                                                <div className="grid gap-1.5 leading-normal">
                                                    <span className="font-semibold">Send directly to voicemail</span>
                                                    <span className="text-sm text-muted-foreground">Text and voicemail messages will appear in your inbox.</span>
                                                </div>
                                            </Label>
                                            <Label className="flex items-start gap-4 p-4 rounded-md border has-[:checked]:border-primary">
                                                <RadioGroupItem value="spam" />
                                                <div className="grid gap-1.5 leading-normal">
                                                     <span className="font-semibold">Mark as "Spam"</span>
                                                     <span className="text-sm text-muted-foreground">Call will be sent directly to voicemail. Text and voicemail messages will be automatically moved to your inbox "Spam" folder.</span>
                                                </div>
                                            </Label>
                                            <Label className="flex items-start gap-4 p-4 rounded-md border has-[:checked]:border-primary">
                                                <RadioGroupItem value="hard" />
                                                <div className="grid gap-1.5 leading-normal">
                                                     <span className="font-semibold">Block {contact.phone_no}</span>
                                                     <span className="text-sm text-muted-foreground">Callers will hear a not-in-service message. Text and voicemail messages will not be allowed.</span>
                                                      <Button variant="link" size="sm" className="p-0 h-auto justify-start text-primary">
                                                        <PlayCircle className="mr-1 h-4 w-4" /> Preview not-in-service message
                                                      </Button>
                                                </div>
                                            </Label>
                                        </RadioGroup>
                                        <DialogFooter>
                                            <Button variant="secondary" onClick={() => setIsBlockDialogOpen(false)}>Cancel</Button>
                                            <Button variant="destructive" onClick={handleBlock}>Block</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                             )
                         )}
                    </div>
                </div>

            </div>
        </div>
    );
}
