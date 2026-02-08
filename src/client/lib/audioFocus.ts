let activeAudio: HTMLMediaElement | null = null;

export function requestAudioFocus(audio: HTMLMediaElement): void {
  if (activeAudio && activeAudio !== audio && !activeAudio.paused) {
    activeAudio.pause();
  }
  activeAudio = audio;
}

export function releaseAudioFocus(audio: HTMLMediaElement): void {
  if (activeAudio === audio) {
    activeAudio = null;
  }
}
