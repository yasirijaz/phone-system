'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mic, Paperclip, Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  MAX_MESSAGE_MEDIA,
  getMessageMediaKind,
  prepareImageForMms,
  validateMessageMedia,
  type MessageMediaKind,
} from '@/lib/message-media';
import { uploadMmsMedia } from '@/services/twilioService';
import { cn } from '@/lib/utils';

interface PendingMedia {
  id: string;
  file: File;
  previewUrl: string;
  kind: MessageMediaKind;
}

interface MessageComposerProps {
  messageBody: string;
  onMessageBodyChange: (value: string) => void;
  onSend: (payload: { body: string; mediaUrls: string[] }) => Promise<void>;
  isSending?: boolean;
  placeholder?: string;
  className?: string;
}

function PendingMediaPreview({ item }: { item: PendingMedia }) {
  if (item.kind === 'video') {
    return <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline />;
  }

  if (item.kind === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Mic className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />;
}

export default function MessageComposer({
  messageBody,
  onMessageBodyChange,
  onSend,
  isSending = false,
  placeholder = 'Write your message...',
  className,
}: MessageComposerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const busy = isSending || isProcessing;
  const canSend = Boolean(messageBody.trim() || pendingMedia.length);

  const handlePickMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) return;

    const remainingSlots = MAX_MESSAGE_MEDIA - pendingMedia.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Too many attachments',
        description: `You can attach up to ${MAX_MESSAGE_MEDIA} files per message.`,
        variant: 'destructive',
      });
      return;
    }

    const accepted: PendingMedia[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      const error = validateMessageMedia(file);
      if (error) {
        toast({ title: 'Invalid attachment', description: error, variant: 'destructive' });
        continue;
      }

      const kind = getMessageMediaKind(file);
      accepted.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        kind,
      });
    }

    if (accepted.length) {
      setPendingMedia((current) => [...current, ...accepted]);
    }
  };

  const removePendingMedia = (id: string) => {
    setPendingMedia((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const prepareMediaUrl = async (item: PendingMedia): Promise<string> => {
    if (item.kind === 'image') {
      return prepareImageForMms(item.file);
    }
    return uploadMmsMedia(item.file);
  };

  const handleSend = async () => {
    if (!canSend || busy) return;

    setIsProcessing(true);
    try {
      const mediaUrls: string[] = [];
      for (const item of pendingMedia) {
        mediaUrls.push(await prepareMediaUrl(item));
      }

      await onSend({
        body: messageBody.trim(),
        mediaUrls,
      });

      pendingMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingMedia([]);
      onMessageBodyChange('');
    } catch (error: any) {
      if (error?.response) {
        const errorMessage = error.response?.data?.message || 'Failed to send message.';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } else if (error instanceof Error && error.message) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {pendingMedia.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingMedia.map((item) => (
            <div key={item.id} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
              <PendingMediaPreview item={item} />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 rounded-full"
                onClick={() => removePendingMedia(item.id)}
                disabled={busy}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Textarea
          placeholder={placeholder}
          className="min-h-[88px] resize-none pr-24"
          value={messageBody}
          onChange={(e) => onMessageBodyChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePickMedia}
            disabled={busy || pendingMedia.length >= MAX_MESSAGE_MEDIA}
            title="Attach image, video, or audio"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button type="button" size="icon" onClick={() => void handleSend()} disabled={!canSend || busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
