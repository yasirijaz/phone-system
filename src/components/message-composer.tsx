'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadMedia } from '@/services/mediaService';
import {
  MAX_MESSAGE_IMAGES,
  validateMessageImage,
} from '@/lib/message-media';
import { cn } from '@/lib/utils';

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface MessageComposerProps {
  messageBody: string;
  onMessageBodyChange: (value: string) => void;
  onSend: (payload: { body: string; mediaUrls: string[] }) => Promise<void>;
  isSending?: boolean;
  placeholder?: string;
  className?: string;
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const busy = isSending || isUploading;
  const canSend = Boolean(messageBody.trim() || pendingImages.length);

  const handlePickImages = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) return;

    const remainingSlots = MAX_MESSAGE_IMAGES - pendingImages.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Too many images',
        description: `You can attach up to ${MAX_MESSAGE_IMAGES} images per message.`,
        variant: 'destructive',
      });
      return;
    }

    const accepted: PendingImage[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      const error = validateMessageImage(file);
      if (error) {
        toast({ title: 'Invalid image', description: error, variant: 'destructive' });
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (accepted.length) {
      setPendingImages((current) => [...current, ...accepted]);
    }
  };

  const removePendingImage = (id: string) => {
    setPendingImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const handleSend = async () => {
    if (!canSend || busy) return;

    setIsUploading(true);
    try {
      const mediaUrls: string[] = [];
      for (const item of pendingImages) {
        const uploaded = await uploadMedia(item.file, item.file.name);
        if (uploaded.file_url) mediaUrls.push(uploaded.file_url);
      }

      await onSend({
        body: messageBody.trim(),
        mediaUrls,
      });

      pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPendingImages([]);
      onMessageBodyChange('');
    } catch (error: any) {
      if (error?.response) {
        const errorMessage = error.response?.data?.message || 'Failed to send message.';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      }
    } finally {
      setIsUploading(false);
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
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingImages.map((item) => (
            <div key={item.id} className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
              <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 rounded-full"
                onClick={() => removePendingImage(item.id)}
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
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePickImages}
            disabled={busy || pendingImages.length >= MAX_MESSAGE_IMAGES}
            title="Attach image"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Button type="button" size="icon" onClick={() => void handleSend()} disabled={!canSend || busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
