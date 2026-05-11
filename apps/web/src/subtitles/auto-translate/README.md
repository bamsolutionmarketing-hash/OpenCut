# cn-vi-auto

Isolated Chinese → Vietnamese auto-pipeline that lives entirely inside this
namespace plus the route at `apps/web/src/app/cn-to-vi/`.

## Isolation rule

This module is a **read-only consumer** of OpenCut.

- Do **not** edit any file outside `apps/web/src/cn-vi-auto/` or
  `apps/web/src/app/cn-to-vi/`.
- Only import OpenCut modules through their public exports.
- If a helper does not expose what you need, copy and adapt it inside this
  namespace.
- Removing this folder + the `app/cn-to-vi/` route + the `tesseract.js`
  dependency must restore OpenCut to its original state.

Verify isolation with:

```bash
git diff --name-only main HEAD | \
  grep -v -E '^(apps/web/src/cn-vi-auto/|apps/web/src/app/cn-to-vi/|apps/web/package\.json$|bun\.lock$|\.claude/)' \
  && echo "ISOLATION VIOLATED" || echo "isolation OK"
```

## Usage

1. Visit `/cn-to-vi` in the running app.
2. The page auto-creates a "Default" channel profile in `localStorage` on
   first load.
3. Upload three files:
   - **Chinese video (9:16)** — the source clip with hardcoded subtitles
   - **Vietnamese SRT/ASS** — pre-translated by you (the pipeline does **not**
     translate)
   - **PNG logo** *(optional)*
4. Adjust settings in the panel (cover color, TTS toggle, segment duration,
   SFX density, seed, …). Settings auto-save to the active profile.
5. Hit **Process**. The orchestrator runs all 13 pipeline stages, emits
   progress, and creates a new editor project on success. Open it from the
   "Open editor" button.

## Pipeline overview

```
Video (CN) + SRT (VI) + Logo + Profile
        │
        ▼
sample-frames → ocr → match → MatchedCue[]
        │
        ▼
tts → fit-audio
        │
        ▼
classify → pick-sfx → segment-variation → logo-placement
        │
        ▼
build-{cover,caption,audio,logo,segment,sfx} elements
        │
        ▼
BatchCommand([AddMediaAssetCommand, …, InsertElementCommand, …])
        │
        ▼
editor.command.execute  →  editor → export
```

## File map

```
cn-vi-auto/
├── README.md
├── LIMITATIONS.md
├── PLAN.md                       — step-by-step build plan (1 step = 1 commit)
├── types.ts                      — shared types (BBox, MatchedCue, FittedTts, …)
├── defaults.ts                   — DEFAULT_PIPELINE_OPTIONS, FRAME_SAMPLING_FPS, …
├── random-utils.ts               — seeded mulberry32 RNG
├── sample-frames.ts              — mediabunny-based frame extraction
├── ocr.ts                        — tesseract.js wrapper (chi_sim + chi_tra)
├── default-zone.ts               — bottom-center fallback bbox
├── match.ts                      — SRT cue → bbox matching (median + nearest-neighbor)
├── tts.ts / tts-cache.ts         — MMS-TTS via @huggingface/transformers + IDB cache
├── workers/tts.worker.ts         — TTS Web Worker
├── fit-audio.ts                  — SoundTouch tempo via OfflineAudioContext
├── wav.ts                        — pure 16-bit PCM WAV encoder
├── units.ts                      — bbox ↔ canvas-centered transform helpers
├── build-cover-element.ts        — graphic rectangle elements
├── build-caption-element.ts      — text elements positioned by bbox
├── build-audio-element.ts        — TTS WAV → CreateUploadAudioElement
├── zones.ts                      — 9-zone layout for logo
├── logo-placement.ts             — slot/zone picking with anti-repeat + caption-avoid
├── build-logo-elements.ts        — image elements per logo slot
├── segment-variation.ts          — split + random transforms
├── build-segment-elements.ts     — per-segment video elements with retime + trim
├── sfx/
│   ├── manifest.ts               — 49 typed SFX entries (audio not bundled)
│   ├── keywords-vi.ts            — Vietnamese emotion keyword map
│   ├── classifier.ts             — tokenize + classify cues
│   ├── picker.ts                 — emotion / text / transition pickers + density limit
│   ├── build-sfx-elements.ts     — fetch + element builder
│   └── LICENSES.md               — license attribution + audio normalization spec
├── profile-store.ts              — localStorage CRUD for ChannelProfile
├── progress.ts                   — typed PipelineEmitter
├── orchestrator.ts               — runCnToViPipeline (the entry point)
└── __tests__/                    — 115 unit tests across 14 files
```

## Public entry point

```ts
import { runCnToViPipeline } from "@/cn-vi-auto/orchestrator";

await runCnToViPipeline({
  videoFile,                     // File
  subtitleFile,                  // File
  logoFile,                      // File | null
  options,                       // PipelineOptions (from active profile)
  signal,                        // AbortSignal
  onProgress: (p) => console.log(p.stage, p.current, "/", p.total),
});
```

## Tests

```bash
cd apps/web && bun test src/cn-vi-auto/__tests__
```

## Status

See `PLAN.md` for the per-step checklist and `LIMITATIONS.md` for known gaps.
