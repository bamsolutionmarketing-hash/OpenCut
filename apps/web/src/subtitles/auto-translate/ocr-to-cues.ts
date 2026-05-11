import type { SubtitleCue } from "@/subtitles/types";
import type { OcrFrame } from "./types";

// Normalize OCR text for comparison (trim, collapse whitespace)
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Derive SubtitleCue[] directly from OCR frames when no SRT is available.
// Groups consecutive frames that share the same primary text into a single cue.
export function ocrFramesToCues({
  frames,
  minDurationSec = 0.5,
  gapPadSec = 0.15,
}: {
  frames: OcrFrame[];
  minDurationSec?: number;
  gapPadSec?: number;
}): SubtitleCue[] {
  // Only keep frames that have at least one OCR box
  const active = frames
    .filter((f) => f.boxes.length > 0)
    .sort((a, b) => a.timeSec - b.timeSec);

  if (active.length === 0) return [];

  const groups: { text: string; startSec: number; endSec: number }[] = [];
  let current: (typeof groups)[0] | null = null;

  for (const frame of active) {
    // Use the box with the highest y (bottom subtitle area) or highest confidence
    const sorted = [...frame.boxes].sort(
      (a, b) => b.bbox.y - a.bbox.y || b.confidence - a.confidence
    );
    const text = normalize(sorted[0]!.text);
    if (!text) continue;

    if (!current || current.text !== text) {
      if (current) groups.push(current);
      current = { text, startSec: frame.timeSec, endSec: frame.timeSec };
    } else {
      current.endSec = frame.timeSec;
    }
  }
  if (current) groups.push(current);

  // Build SubtitleCue[], skipping groups shorter than minDurationSec
  return groups
    .filter((g) => g.endSec - g.startSec + gapPadSec >= minDurationSec)
    .map((g, i) => ({
      text: g.text,
      startTime: g.startSec,
      duration: Math.max(minDurationSec, g.endSec - g.startSec + gapPadSec),
      id: `ocr-cue-${i}`,
    }));
}
