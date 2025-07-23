"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import type { Call } from "@/types"
import { getCategoryForNotes } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LogCallFormProps {
  onCallAdded: (call: Partial<Call>) => void
}

const formSchema = z.object({
  contact: z.string().min(2, { message: 'Contact name must be at least 2 characters.' }),
  dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Please select a valid date and time" }),
  duration: z.coerce.number().min(1, { message: 'Duration must be at least 1 minute.' }),
  direction: z.enum(['inbound', 'outbound'], { required_error: "You must select a call type." }),
  notes: z.string().optional(),
  category: z.string().optional(),
});

export default function LogCallForm({ onCallAdded }: LogCallFormProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contact: "",
      dateTime: new Date().toISOString().substring(0, 16),
      duration: 10,
      direction: "inbound",
      notes: "",
      category: "",
    },
  });

  const handleCategorize = async () => {
    const notes = form.getValues("notes");
    if (!notes) {
       toast({
        title: "No notes provided",
        description: "Please enter some notes to categorize the call.",
        variant: "destructive",
      });
      return;
    }
    setIsCategorizing(true);
    const result = await getCategoryForNotes(notes);
    if (result.category) {
      form.setValue("category", result.category);
      toast({
        title: "Categorization successful!",
        description: `Call category set to "${result.category}".`,
      });
    } else if (result.error) {
       toast({
        title: "Categorization Error",
        description: result.error,
        variant: "destructive",
      });
    }
    setIsCategorizing(false);
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    const callData: Partial<Call> = {
        id: crypto.randomUUID(),
        from: values.direction === 'inbound' ? values.contact : 'Me',
        to: values.direction === 'outbound' ? values.contact : 'Me',
        created_at: values.dateTime,
        duration: String(values.duration),
        direction: values.direction,
        notes: values.notes,
        category: values.category
    }
    onCallAdded(callData);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name/Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jane Doe or +1..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="dateTime"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Date & Time</FormLabel>
                <FormControl>
                    <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                    <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <FormField
          control={form.control}
          name="direction"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Call Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex items-center space-x-4"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="inbound" />
                    </FormControl>
                    <FormLabel className="font-normal">Incoming</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="outbound" />
                    </FormControl>
                    <FormLabel className="font-normal">Outgoing</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="What was discussed during the call?" {...field} rows={5} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCategorize} disabled={isCategorizing} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                {isCategorizing ? 'Categorizing...' : 'Categorize with AI'}
            </Button>
            <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel className="sr-only">Category</FormLabel>
                <FormControl>
                    <Input placeholder="e.g. Sales" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>


        <Button type="submit" className="w-full">Save Call</Button>
      </form>
    </Form>
  )
}
