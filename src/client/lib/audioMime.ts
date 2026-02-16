function normalizeBase64(raw: string): string {
  const trimmed = raw.trim();
  const marker = "base64,";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + marker.length);
  }
  return trimmed;
}

export function detectAudioMimeFromBase64(rawBase64: string): string {
  const base64 = normalizeBase64(rawBase64);
  const head = base64.slice(0, 24);

  if (head.startsWith("UklGR")) return "audio/wav";
  if (head.startsWith("SUQz") || head.startsWith("/+MY") || head.startsWith("//uQ")) return "audio/mpeg";
  if (head.startsWith("T2dnUw")) return "audio/ogg";
  if (head.startsWith("fLaC")) return "audio/flac";
  if (head.startsWith("AAAAFGZ0eXA")) return "audio/mp4";

  return "audio/wav";
}

export function toAudioDataUrl(rawBase64: string): string {
  const base64 = normalizeBase64(rawBase64);
  const mime = detectAudioMimeFromBase64(base64);
  return `data:${mime};base64,${base64}`;
}
