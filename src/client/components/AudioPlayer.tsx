import { useEffect, useRef } from "react";

interface AudioPlayerProps {
  base64: string;
  autoPlay?: boolean;
}

export default function AudioPlayer({ base64, autoPlay = true }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [base64, autoPlay]);

  const src = `data:audio/wav;base64,${base64}`;

  return (
    <audio
      ref={audioRef}
      src={src}
      controls
      className="mt-2 h-9 w-full max-w-[260px] rounded-lg"
    />
  );
}
