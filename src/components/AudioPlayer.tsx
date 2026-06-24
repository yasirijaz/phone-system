'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const mins = Math.floor(wholeSeconds / 60);
  const secs = wholeSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function readAudioDuration(audioEl: HTMLAudioElement): number {
  const value = audioEl.duration;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function waitForMediaReady(audioEl: HTMLAudioElement): Promise<void> {
  const isReady = () =>
    audioEl.readyState >= HTMLMediaElement.HAVE_METADATA && readAudioDuration(audioEl) > 0;

  if (isReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const tryResolve = () => {
      if (isReady()) {
        cleanup();
        resolve();
      }
    };

    const onCanPlayThrough = () => tryResolve();
    const onLoadedMetadata = () => tryResolve();
    const onError = () => {
      cleanup();
      reject(new Error('Unable to load audio'));
    };

    const cleanup = () => {
      audioEl.removeEventListener('canplaythrough', onCanPlayThrough);
      audioEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      audioEl.removeEventListener('error', onError);
    };

    audioEl.addEventListener('canplaythrough', onCanPlayThrough);
    audioEl.addEventListener('loadedmetadata', onLoadedMetadata);
    audioEl.addEventListener('error', onError);
  });
}

type AudioPlayerProps = {
  src: string;
  type: string;
  durationHint?: number;
};

const AudioPlayer = ({ src, type, durationHint }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const isSeekingRef = useRef(false);
  const isAudioReadyRef = useRef(false);
  const knownDurationRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [duration, setDuration] = useState(() => durationHint ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamUrl = useMemo(
    () =>
      `${process.env.NEXT_PUBLIC_API_URL}/api/twilio/recordings/stream?url=${encodeURIComponent(src)}`,
    [src]
  );

  const markAudioReady = useCallback((ready: boolean) => {
    isAudioReadyRef.current = ready;
    setIsAudioReady(ready);
  }, []);

  const syncDurationFromAudio = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const fromAudio = readAudioDuration(audioEl);
    const next = Math.max(fromAudio, knownDurationRef.current);
    if (next > 0) {
      setDuration(next);
    }
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const attachBlobToAudio = useCallback(async (objectUrl: string) => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (audioEl.src !== objectUrl) {
      audioEl.src = objectUrl;
      audioEl.load();
    }

    await waitForMediaReady(audioEl);
    syncDurationFromAudio();
    markAudioReady(true);
  }, [markAudioReady, syncDurationFromAudio]);

  useEffect(() => {
    knownDurationRef.current = durationHint ?? 0;
    if (durationHint && durationHint > 0) {
      setDuration((prev) => Math.max(prev, durationHint));
    }
  }, [durationHint]);

  useEffect(() => {
    setIsPlaying(false);
    setIsLoading(false);
    markAudioReady(false);
    setCurrentTime(0);
    setError(null);
    loadPromiseRef.current = null;
    revokeObjectUrl();

    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
  }, [streamUrl, markAudioReady, revokeObjectUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  const loadAudio = useCallback(async () => {
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }

    if (objectUrlRef.current) {
      await attachBlobToAudio(objectUrlRef.current);
      return;
    }

    loadPromiseRef.current = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(streamUrl);
        if (!response.ok) {
          throw new Error('Unable to fetch recording');
        }

        const blob = await response.blob();
        if (!blob.size) {
          throw new Error('Empty recording');
        }

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        await attachBlobToAudio(objectUrl);
      } catch {
        markAudioReady(false);
        setError('Unable to load audio');
        throw new Error('Unable to load audio');
      } finally {
        setIsLoading(false);
        loadPromiseRef.current = null;
      }
    })();

    await loadPromiseRef.current;
  }, [attachBlobToAudio, markAudioReady, streamUrl]);

  const pauseOtherPlayers = useCallback(() => {
    document.querySelectorAll('audio').forEach((el) => {
      if (el !== audioRef.current) {
        (el as HTMLAudioElement).pause();
      }
    });
  }, []);

  const seekTo = useCallback((time: number) => {
    const audioEl = audioRef.current;
    const effectiveDuration = Math.max(duration, knownDurationRef.current);
    if (!audioEl || effectiveDuration <= 0 || !isAudioReadyRef.current) return;

    const nextTime = Math.min(Math.max(time, 0), effectiveDuration);
    setCurrentTime(nextTime);

    try {
      audioEl.currentTime = nextTime;
    } catch {
      // Ignore seek errors until the blob is fully decoded.
    }
  }, [duration]);

  const finishSeek = useCallback(
    (time: number) => {
      const audioEl = audioRef.current;
      if (!audioEl) {
        isSeekingRef.current = false;
        return;
      }

      const finalize = () => {
        isSeekingRef.current = false;
        setCurrentTime(audioEl.currentTime);
      };

      const onSeeked = () => {
        audioEl.removeEventListener('seeked', onSeeked);
        finalize();
      };

      audioEl.addEventListener('seeked', onSeeked);
      seekTo(time);

      window.setTimeout(() => {
        audioEl.removeEventListener('seeked', onSeeked);
        if (isSeekingRef.current) {
          finalize();
        }
      }, 250);
    },
    [seekTo]
  );

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const audioEl = audioRef.current;
    if (!audioEl || error) return;

    if (isPlaying) {
      audioEl.pause();
      return;
    }

    pauseOtherPlayers();
    setIsLoading(true);

    void (async () => {
      try {
        if (!isAudioReadyRef.current) {
          await loadAudio();
        }

        if (audioEl.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
          await waitForMediaReady(audioEl);
        }

        await audioEl.play();
      } catch {
        setError('Unable to play audio');
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setError(null);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      const effectiveDuration = Math.max(readAudioDuration(audioEl), knownDurationRef.current);
      setCurrentTime(effectiveDuration);
    };
    const handleTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setCurrentTime(audioEl.currentTime);
      }
      syncDurationFromAudio();
    };
    const handleLoadedMetadata = () => {
      syncDurationFromAudio();
    };
    const handleDurationChange = () => {
      syncDurationFromAudio();
    };
    const handleWaiting = () => {
      if (isAudioReadyRef.current) {
        setIsLoading(true);
      }
    };
    const handleCanPlay = () => {
      setIsLoading(false);
    };
    const handleError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      if (isAudioReadyRef.current) {
        setError('Unable to play audio');
      }
    };

    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioEl.addEventListener('durationchange', handleDurationChange);
    audioEl.addEventListener('waiting', handleWaiting);
    audioEl.addEventListener('canplay', handleCanPlay);
    audioEl.addEventListener('error', handleError);

    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.removeEventListener('durationchange', handleDurationChange);
      audioEl.removeEventListener('waiting', handleWaiting);
      audioEl.removeEventListener('canplay', handleCanPlay);
      audioEl.removeEventListener('error', handleError);
    };
  }, [syncDurationFromAudio]);

  const effectiveDuration = Math.max(duration, knownDurationRef.current);
  const sliderMax = effectiveDuration > 0 ? effectiveDuration : 100;
  const sliderValue = effectiveDuration > 0 ? currentTime : 0;
  const canSeek = isAudioReady && effectiveDuration > 0 && !error;

  return (
    <div
      className="flex min-w-[220px] max-w-xs flex-col gap-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          disabled={Boolean(error)}
          className={cn(
            'shrink-0',
            type === 'Voicemail' && 'bg-red-500 text-white hover:bg-red-600'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div className="min-w-0 flex-1">
          <Slider
            value={[sliderValue]}
            min={0}
            max={sliderMax}
            step={0.1}
            disabled={!canSeek}
            onValueChange={(value) => {
              isSeekingRef.current = true;
              seekTo(value[0] ?? 0);
            }}
            onValueCommit={(value) => {
              finishSeek(value[0] ?? 0);
            }}
            aria-label="Seek audio"
          />
        </div>

        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(effectiveDuration)}
        </span>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {/* src is set imperatively after fetch — avoid React-controlled src reloads */}
      <audio ref={audioRef} preload="none" className="hidden" />
    </div>
  );
};

export default AudioPlayer;
