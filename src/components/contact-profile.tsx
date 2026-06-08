
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ChevronDown, PlusCircle, PanelRightOpen, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { createContact, updateContact, blockContact, unblockContact, findContactByPhone, formatContactPhoneForApi } from '@/services/contactService';
import type { Contact } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { formatPhoneNumber, phonesMatch } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface ContactProfileProps {
    contact: Partial<Contact> & {
        sublabel?: string | null;
        hasContactName?: boolean;
        apiContactName?: string | null;
        isSavedFromApi?: boolean;
    };
    contacts?: Contact[];
    onContactUpdate: () => void;
    onCollapse: () => void;
}

const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.preprocess(
    (val) => (val == null ? '' : String(val).trim()),
    z.union([z.literal(''), z.string().email("Invalid email address.")])
  ),
  phone_no: z.string().min(10, "Phone number is required."),
  phone_type: z.string().min(1, "Phone type is required."),
});

type BlockOption = 'voicemail' | 'spam' | 'hard';

function isContactBlocked(contact: Partial<Contact> | null | undefined): boolean {
    if (!contact) return false;
    return Boolean(contact.is_block) || contact.status === 'blocked';
}

function resolveSavedContact(
    contact: ContactProfileProps['contact'],
    contacts?: Contact[]
): Partial<Contact> | null {
    if (typeof contact?.id === 'number' && contact.id > 0) {
        return contact;
    }

    const matched = contacts?.find((c) => phonesMatch(c.phone_no, contact?.phone_no));
    if (matched) {
        return {
            ...matched,
            name: contact.apiContactName || matched.name || contact?.name,
            phone_no: contact?.phone_no || matched.phone_no,
        };
    }

    if (contact.isSavedFromApi) {
        return {
            name: contact.apiContactName || contact.name,
            phone_no: contact.phone_no,
            email: contact.email,
            phone_type: contact.phone_type,
            is_block: contact.is_block,
            status: contact.status,
        };
    }

    return null;
}

export default function ContactProfile({ contact, contacts, onContactUpdate, onCollapse }: ContactProfileProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
    const [selectedBlockOption, setSelectedBlockOption] = useState<BlockOption>('voicemail');

    const savedContact = useMemo(
        () => resolveSavedContact(contact, contacts),
        [contact, contacts]
    );
    const isSavedContact = Boolean(contact.isSavedFromApi);
    const isBlocked = isContactBlocked(savedContact);
    const savedContactId = useMemo(() => {
        if (typeof contact?.id === 'number' && contact.id > 0) return contact.id;
        if (typeof savedContact?.id === 'number' && savedContact.id > 0) return savedContact.id;
        return contacts?.find((c) => phonesMatch(c.phone_no, contact.phone_no))?.id ?? null;
    }, [contact, savedContact, contacts]);

    const resolveContactId = async (): Promise<number | null> => {
        if (savedContactId) return savedContactId;
        if (!user?.company_id || !contact.phone_no) return null;
        const found = await findContactByPhone(user.company_id, contact.phone_no);
        return found?.id ?? null;
    };

    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: "",
            email: "",
            phone_no: "",
            phone_type: "mobile",
        }
    });

    useEffect(() => {
        if (!contact) return;

        form.reset({
            name: savedContact?.name || contact.name || '',
            email: savedContact?.email || contact.email || '',
            phone_no: savedContact?.phone_no || contact.phone_no || '',
            phone_type: savedContact?.phone_type || contact.phone_type || 'mobile',
        });
    }, [contact, savedContact, form]);
    
    const handleAddClick = () => {
        form.reset({
            name: '',
            email: '',
            phone_no: contact.phone_no || '',
            phone_type: 'mobile',
        });
        setIsEditing(true);
    };

    const openEditDialog = () => {
        form.reset({
            name: savedContact?.name || contact.apiContactName || contact.name || '',
            email: savedContact?.email || contact.email || '',
            phone_no: savedContact?.phone_no || contact.phone_no || '',
            phone_type: savedContact?.phone_type || contact.phone_type || 'mobile',
        });
        setIsEditing(true);
    };
    
    if (!contact?.phone_no) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Select a conversation to see details.</p>
            </div>
        );
    }
    
    const displayName = contact.name || formatPhoneNumber(contact.phone_no);
    const contactInitial = displayName ? displayName.charAt(0).toUpperCase() : '?';

    const handleFormSubmit = async (values: z.infer<typeof contactSchema>) => {
        if (!user?.company_id) return;
        const payload = {
            ...values,
            email: values.email?.trim() || null,
            phone_no: formatContactPhoneForApi(values.phone_no),
            company_id: user.company_id,
        };

        try {
            if (isSavedContact) {
                const contactId = await resolveContactId();
                if (!contactId) {
                    toast({
                        title: 'Error',
                        description: 'Could not find this contact to update. Try refreshing the page.',
                        variant: 'destructive',
                    });
                    return;
                }
                await updateContact(contactId, payload);
                toast({ title: 'Success', description: 'Contact updated.' });
            } else {
                await createContact(payload);
                toast({ title: 'Success', description: 'Contact created.' });
            }
            onContactUpdate();
            setIsEditing(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save contact.', variant: 'destructive' });
        }
    };
    
    const handleBlock = async () => {
        const contactId = await resolveContactId();
        if (!contactId) {
            toast({
                title: 'Error',
                description: 'Could not find this contact to block. Try refreshing the page.',
                variant: 'destructive',
            });
            return;
        }
        try {
            await blockContact(contactId, selectedBlockOption);
            toast({ title: 'Success', description: `Contact has been blocked.` });
            onContactUpdate();
            setIsBlockDialogOpen(false);
        } catch (error: any) {
             toast({ title: 'Error', description: error.response?.data?.message || `Failed to block contact.`, variant: 'destructive' });
        }
    };
    
    const handleUnblock = async () => {
        const contactId = await resolveContactId();
        if (!contactId) {
            toast({
                title: 'Error',
                description: 'Could not find this contact to unblock. Try refreshing the page.',
                variant: 'destructive',
            });
            return;
        }
        try {
            await unblockContact(contactId);
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
                    <div className="flex-1 flex items-center justify-between min-w-0">
                         <div className="min-w-0">
                           <h3 className="text-xl font-bold truncate">{displayName}</h3>
                           {contact.sublabel && (
                             <p className="text-sm text-muted-foreground truncate">{contact.sublabel}</p>
                           )}
                         </div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="shrink-0">
                                  <ChevronDown className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {isSavedContact ? (
                                  <>
                                    <DropdownMenuItem onSelect={openEditDialog}>
                                      Edit contact
                                    </DropdownMenuItem>
                                    {isBlocked ? (
                                      <DropdownMenuItem onSelect={handleUnblock}>
                                        Unblock contact
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => setIsBlockDialogOpen(true)}
                                      >
                                        Block contact
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                ) : (
                                  <DropdownMenuItem onSelect={handleAddClick}>
                                    Add contact
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                         </DropdownMenu>
                    </div>
                </div>

                <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{savedContact?.phone_type || contact.phone_type || 'Other'}</span>
                        <span>{formatPhoneNumber(savedContact?.phone_no || contact.phone_no)}</span>
                    </div>
                     <div className="flex justify-between gap-2">
                        <Dialog open={isEditing} onOpenChange={setIsEditing}>
                            {!isSavedContact && (
                              <DialogTrigger asChild>
                                  <Button className="w-full" onClick={handleAddClick}>
                                      <PlusCircle className="mr-2 h-4 w-4" /> Add contact
                                  </Button>
                              </DialogTrigger>
                            )}
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
                             isBlocked ? (
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="w-full">Unblock Contact</Button>
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
                                            <DialogTitle>BLOCK {formatPhoneNumber(savedContact?.phone_no || contact.phone_no)}</DialogTitle>
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
                                                     <span className="font-semibold">Block {formatPhoneNumber(savedContact?.phone_no || contact.phone_no)}</span>
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
