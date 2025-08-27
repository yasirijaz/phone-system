import React, { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from './ui/button';

const AudioPlayer = ({ src, type }: { src: string, type: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!audioRef.current) return;

    document.querySelectorAll("audio").forEach((el) => {
        if (el !== audioRef.current) {
        (el as HTMLAudioElement).pause();
        }
    });

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audioEl.addEventListener("play", handlePlay);
    audioEl.addEventListener("pause", handlePause);
    audioEl.addEventListener("ended", handleEnded);

    return () => {
      audioEl.removeEventListener("play", handlePlay);
      audioEl.removeEventListener("pause", handlePause);
      audioEl.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      
      <audio ref={audioRef} src={`${process.env.NEXT_PUBLIC_API_URL}/api/twilio/recordings/stream?url=${encodeURIComponent(src)}`}  className="hidden" preload="none" />
      <span className="text-xs text-muted-foreground">Play {type}</span>
    </div>
  );
};

export default AudioPlayer;