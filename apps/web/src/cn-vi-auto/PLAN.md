# CN-VI Auto Pipeline — Detailed Step Plan

This file is the **source of truth** for the implementation order.
Each step is small enough to fit in a single commit and a single context window.

Mark progress with `[x]` after each step is committed.

Format: `S{stage}.{step}` — e.g. `S2.3` = Stage 2, step 3.

---

## STAGE 0 — Bootstrap (DONE)

- [x] S0.1 Add `tesseract.js` to `apps/web/package.json`
- [x] S0.2 Create `cn-vi-auto/README.md` (isolation rule)
- [x] S0.3 Create `cn-vi-auto/types.ts`
- [x] S0.4 Create `cn-vi-auto/random-utils.ts` (seeded RNG)
- [x] S0.5 Create `cn-vi-auto/defaults.ts` (option presets)
- [x] S0.6 Commit Stage 0

---

## STAGE 1 — Frame Sampling

Goal: Extract `ImageData` frames at 6 fps from a video, cropped to bottom 35% ROI.

- [x] S1.1 Create `cn-vi-auto/sample-frames.ts` skeleton with type signature
- [x] S1.2 Implement `openVideoInput(file)` — returns `mediabunny` `Input`
- [x] S1.3 Implement `getVideoMetadata(input)` — duration, width, height, fps
- [x] S1.4 Implement `computeSampleTimestamps(durationSec, fps)` — array of times
- [x] S1.5 Implement `cropImageDataToROI(imageData, topRatio, heightRatio)` (canvas-based)
- [x] S1.6 Implement `sampleFrame(sink, timeSec)` — returns `ImageData` | null
- [x] S1.7 Implement main `sampleFrames({ file, fps, roi, onProgress })` async generator
- [x] S1.8 Add unit-test file `__tests__/sample-frames.test.ts` (skip actual decode, test pure helpers)
- [ ] S1.9 Manual smoke test: log frame count for a known clip (deferred — needs browser)
- [x] S1.10 Commit Stage 1

---

## STAGE 2 — OCR Worker

Goal: Tesseract.js worker that takes `ImageData` → returns OCR boxes for `chi_sim+chi_tra`.

> Note: Tesseract.js v7's `createWorker` already runs OCR off the main thread
> in its own internal Web Worker. The custom worker-protocol layer (S2.1-S2.7)
> was therefore skipped — `ocr.ts` calls Tesseract directly.

- [x] S2.1 ~~Create `cn-vi-auto/workers/ocr.worker.ts` skeleton~~ (skipped — Tesseract has its own)
- [x] S2.2 ~~Define worker request/response types~~ (skipped)
- [x] S2.3 ~~Implement worker init message~~ (skipped)
- [x] S2.4 ~~Implement worker recognize message~~ (skipped)
- [x] S2.5 ~~Inside worker: load createWorker with chi_sim+chi_tra~~ → done in `ocr.ts`
- [x] S2.6 ~~Inside worker: handle recognize~~ → done in `ocr.ts`
- [x] S2.7 ~~Inside worker: progress event proxying~~ → done via `onLoad` callback
- [x] S2.8 Create `cn-vi-auto/ocr.ts` — main thread wrapper
- [x] S2.9 Implement `createOcrSession()` returns `{ recognize, dispose }`
- [x] S2.10 Implement frame-by-frame `recognizeFrames(frames, session, onProgress)`
- [x] S2.11 Convert tesseract bbox to local `BBox` type (offset Y by ROI top, scale by downscale ratio)
- [x] S2.12 Filter boxes below `OCR_MIN_CONFIDENCE`
- [x] S2.13 Add `__tests__/ocr-coords.test.ts` for coord conversion (pure function)
- [ ] S2.14 Manual test: 1 frame with Chinese hard-sub → returns sane bbox (deferred — needs browser)
- [x] S2.15 Commit Stage 2

---

## STAGE 3 — SRT Matching + Default Zone

Goal: Map each SRT cue to its visual bbox using OCR results (or fallback).

- [x] S3.1 Create `cn-vi-auto/default-zone.ts` — `computeDefaultZone(canvas)`
- [x] S3.2 Create `cn-vi-auto/match.ts` skeleton
- [x] S3.3 Implement `framesInTimeRange(frames, startSec, endSec)`
- [x] S3.4 Implement `mergeBoxesPerFrame(frame)` — merge multi-line boxes vertically adjacent
- [x] S3.5 Implement `medianBBox(bboxes)` (independent median of x, y, w, h)
- [x] S3.6 Implement `padBBox(bbox, paddingRatio, canvas)` — clamp to canvas
- [x] S3.7 Implement `matchCueToBBox(cue, ocrFrames, canvas, options)` returns `MatchedCue`
- [x] S3.8 Add `bboxSource` tracking ("ocr" | "default-zone" | "nearest-neighbor")
- [x] S3.9 Implement nearest-neighbor fallback: when cue has 0 OCR hits, use bbox of nearest cue ±2s
- [x] S3.10 Implement `matchAllCues(cues, ocrFrames, canvas, options)`
- [x] S3.11 Add `__tests__/match.test.ts` with mock OCR data
- [x] S3.12 Commit Stage 3

---

## STAGE 4 — TTS Worker

Goal: MMS-TTS Vietnamese model running in a WebWorker, returning PCM Float32.

- [x] S4.1 ~~Create `cn-vi-auto/workers/tts-protocol.ts`~~ → co-located in `tts.worker.ts` (matches OpenCut's transcription pattern)
- [x] S4.2 Create `cn-vi-auto/workers/tts.worker.ts` skeleton
- [x] S4.3 Inside worker: import `@huggingface/transformers`
- [x] S4.4 Inside worker: load `pipeline("text-to-speech", "Xenova/mms-tts-vie")`
- [x] S4.5 Inside worker: progress proxy (file-bytes aggregation, % overall)
- [x] S4.6 Inside worker: handle `synthesize` message, transfer PCM buffer
- [x] S4.7 Create `cn-vi-auto/tts.ts` main-thread wrapper
- [x] S4.8 Implement `createTtsSession()` with init/synthesize/dispose + AbortSignal
- [x] S4.9 Implement IndexedDB cache (`tts-cache.ts`) by `hashString(text)` key
- [x] S4.10 Implement `synthesizeAll(cues, session, onProgress)` — sequential
- [ ] S4.11 Manual test: 1 short Vietnamese string → non-empty Float32Array (deferred — needs browser)
- [x] S4.12 Cache-hit path implemented in `synthesize()` (read before postMessage)
- [x] S4.13 Commit Stage 4

---

## STAGE 5 — TTS Time-Fit

Goal: Force-fit each TTS PCM into its cue's slot duration via soundtouchjs.

- [x] S5.1 Create `cn-vi-auto/fit-audio.ts` skeleton
- [x] S5.2 Implement `padSilence(pcm, targetSamples)` + `trimToLength`
- [x] S5.3 Implement `applyTempo(pcm, sampleRate, ratio)` via PitchShifter + OfflineAudioContext
- [x] S5.4 Implement `fitTtsToSlot(tts, slotDurationSec)` returning `FittedTts`
- [x] S5.5 Track `speedRatio` and emit `tts-fast` warning when > THRESHOLD
- [x] S5.6 Implement `fitAll(ttsResults, cues, threshold)` returning `(FittedTts, warnings)`
- [x] S5.7 Add `__tests__/fit-audio.test.ts` for pure ratio math
- [x] S5.8 Commit Stage 5

---

## STAGE 6 — Element Builders

Goal: Pure functions that turn matched cues + options into OpenCut element specs.

- [x] S6.1 Create `cn-vi-auto/units.ts` — px↔canvas-units helpers
- [x] S6.2 Implement `bboxCenterToCanvasPosition(bbox, canvas)` + `bboxToGraphicScale`
- [x] S6.3 Create `cn-vi-auto/build-cover-element.ts`
- [x] S6.4 Implement `buildCoverElement` returning `CreateGraphicElement`
- [x] S6.5 Cover type chosen: `graphic` rectangle (definitionId="rectangle") via OpenCut's `buildGraphicElement`
- [x] S6.6 Create `cn-vi-auto/build-caption-element.ts`
- [x] S6.7 Adapt subtitle builder to explicit `bbox` placement (center-coord transform)
- [x] S6.8 Font size derived from bbox height in `units.fontSizeForBBoxHeight`
- [x] S6.9 Apply user font/color from `CaptionStyleOptions`
- [x] S6.10 Create `cn-vi-auto/build-audio-element.ts` + extract pure `wav.ts`
- [x] S6.11 Implement `pcmToWavBlob(pcm, sampleRate)` (16-bit PCM, mono)
- [ ] S6.12 ~~Implement `registerAudioMediaAsset` here~~ → moved to Stage 12 orchestrator (public API)
- [x] S6.13 Implement `buildAudioElement(mediaId, fittedTts, startSec)` → CreateUploadAudioElement
- [x] S6.14 Add `__tests__/units.test.ts` + `__tests__/wav.test.ts`
- [x] S6.15 Commit Stage 6

---

## STAGE 7 — Logo Placement

Goal: Logo image placed across timeline, repositioned each N seconds, avoiding caption bbox.

- [x] S7.1 Create `cn-vi-auto/zones.ts` with 9-zone definition
- [x] S7.2 Implement `getZoneRect(zone, canvas, sizeRatio, padding)`
- [x] S7.3 Implement `zoneOverlapsCaption(zoneRect, captionBBoxes)` + `bboxesOverlap`
- [x] S7.4 Create `cn-vi-auto/logo-placement.ts` (pure helpers, no `@/wasm`)
- [x] S7.5 Implement `computeLogoSlotTimes(totalDuration, intervalSec)` + `computeLogoSlots`
- [x] S7.6 Implement `pickZoneForSlot(slot, captionBBoxes, rng, avoidCaption)`
- [x] S7.7 Anti-repeat: filter previous zone unless only one candidate left
- [x] S7.8 Implement `buildLogoElements` in `build-logo-elements.ts` (separate to keep helpers test-pure)
- [x] S7.9 Add `__tests__/zones.test.ts` (zone math + overlap + pickZone determinism)
- [x] S7.10 Commit Stage 7

---

## STAGE 8 — Segment Variation

Goal: Split video into N-second segments, each with a random transform set.

- [x] S8.1 Create `cn-vi-auto/segment-variation.ts` skeleton (pure helpers)
- [x] S8.2 `computeSegmentBoundaries` with cue-gap snap (snap forward to cue end if cut would split it)
- [x] S8.3 `pickTransformsForSegment(rng, opts, containsCue)` → `SegmentInstance`
- [x] S8.4 Flip suppressed when `containsCue` (text would mirror)
- [x] S8.5 `paramsFromSegment(segment, canvas)` → ParamValues
- [x] S8.6 Used `transform.positionX/Y/scaleX/Y/rotate`; flip = negative scaleX
- [x] S8.7 `buildSegmentVideoElements` with `trimStart`/`trimEnd` + sequential `startTime`
- [ ] S8.8 ~~Zoom-mode keyframes~~ → deferred to Stage 14 polish; v1 ships static-only
- [x] S8.9 Decided: skip keyframes for v1 (zoomMode is recorded but only "static" is rendered)
- [x] S8.10 Add `__tests__/segment-variation.test.ts` (boundaries, transforms, params, determinism)
- [x] S8.11 Commit Stage 8

---

## STAGE 9 — SFX Bundle + Manifest

Goal: Pre-bundle ~50 royalty-free sound effects with metadata.

- [x] S9.1 Create `cn-vi-auto/sfx/` namespace
- [~] S9.2-S9.15 Manifest entries declared for all 49 categories (audio files NOT bundled — placeholder only)
- [ ] S9.16 Normalize all to -16 LUFS, mp3 96kbps mono — manual step, deferred
- [x] S9.17 Create `sfx/manifest.ts` with all entries (id, file, duration, gain, category, tags, source, license)
- [x] S9.18 Add per-file LICENSE format in `sfx/LICENSES.md`
- [x] S9.19 Commit Stage 9

> **Note:** S9.2–S9.16 require manual asset sourcing (downloading/normalizing
> CC0 audio). The manifest is fully typed and committed; orchestrator (S12)
> will skip-and-warn for missing files so the pipeline runs end-to-end before
> assets are populated.

> Note: if sourcing SFX requires manual download, this stage may be split or
> use a placeholder set. Document any placeholders explicitly.

---

## STAGE 10 — SFX Classifier + Picker + Builder

Goal: Auto-tag Vietnamese cues with emotions and pick SFX accordingly.

- [x] S10.1 Create `cn-vi-auto/sfx/keywords-vi.ts` — keyword → emotion map
- [x] S10.2 Implement `tokenizeVietnamese(text)` (NFD-strip diacritics, lowercase, đ→d)
- [x] S10.3 Implement `classifyCue(text)` returns `EmotionTag[]`
- [x] S10.4 Punctuation rules: `?` → question, `!` → exclaim, `...`/`…` → suspense
- [x] S10.5 Negation handling: `khong/chang/chua + happy/laugh/romantic` → flip to sad
- [x] S10.6 Add `__tests__/classifier.test.ts` (16 sample cases, neutral fallback, ellipsis)
- [x] S10.7 Create `cn-vi-auto/sfx/picker.ts`
- [x] S10.8 `pickEmotionSfx(emotion, rng, recent)` with anti-repeat (4-deep)
- [x] S10.9 `pickTextSfx(rng, recent)` for text-appear category
- [x] S10.10 `pickTransitionSfx(rng, recent)` for transitions
- [x] S10.11 `pickSfxForCues(cues, options, rng)` — text + emotion picks per cue
- [x] S10.12 `pickSfxForSegmentBoundaries(boundaries, options, rng)`
- [x] S10.13 `limitSfxDensity(picks, maxConcurrent=2)` — drops overlap beyond cap
- [x] S10.14 Create `cn-vi-auto/sfx/build-sfx-elements.ts`
- [x] S10.15 `loadSfxBlob/loadSfxFile` — returns null on 404 (skip-and-warn)
- [ ] S10.16 ~~`registerSfxMediaAsset`~~ → moved to Stage 12 orchestrator (uses public command API)
- [x] S10.17 `buildSfxElement(mediaId, pick, audioBuffer?)` → CreateUploadAudioElement
- [x] S10.18 Commit Stage 10

---

## STAGE 11 — Channel Profiles

Goal: Save/load multi-channel settings presets in localStorage.

- [x] S11.1 Create `cn-vi-auto/profile-store.ts` with injectable storage adapter
- [x] S11.2 Keys: `cn-vi-auto.profiles.v1` + `cn-vi-auto.profiles.active.v1`
- [x] S11.3 `listProfiles()` returns `ChannelProfile[]`
- [x] S11.4 `getActiveProfile()` returns `ChannelProfile | null`
- [x] S11.5 `saveProfile(profile)` upserts and stamps `updatedAt`
- [x] S11.6 `deleteProfile(id)` clears active id when matching
- [x] S11.7 `setActiveProfileId(id)` / `getActiveProfileId()`
- [x] S11.8 `createDefaultProfile(name)` factory using DEFAULT_PIPELINE_OPTIONS
- [x] S11.9 `migrate(state)` fills missing fields, deep-merges options
- [x] S11.10 Add `__tests__/profile-store.test.ts` with in-memory ProfileStorage
- [x] S11.11 Commit Stage 11

---

## STAGE 12 — Orchestrator

Goal: Wire all stages into one `runCnToViPipeline` function.

- [x] S12.1 Create `cn-vi-auto/progress.ts` (typed event emitter)
- [x] S12.2 `createPipelineEmitter` returns `{ on, emit, stage, progress }`
- [x] S12.3 Create `cn-vi-auto/orchestrator.ts` (`runCnToViPipeline`)
- [x] S12.4 Import video via `processMediaAssets` + `AddMediaAssetCommand`
- [x] S12.5 Import logo via same pipeline
- [x] S12.6 Step 1 — import video
- [x] S12.7 Step 2 — `parseSubtitleFile` (handles SRT + ASS)
- [x] S12.8 Step 3 — sample frames
- [ ] S12.9 ~~Parallelize OCR + TTS load~~ → deferred; sequential keeps mental model simple, latency dominated by OCR anyway
- [x] S12.10 Step 5 — match cues
- [x] S12.11 Step 6 — TTS generation
- [x] S12.12 Step 7 — fit audio
- [x] S12.13 Step 8 — classify emotions
- [x] S12.14 Step 9 — pick SFX (cue + transition + density limit)
- [x] S12.15 Step 10 — compute segments
- [x] S12.16 Step 11 — compute logo slots
- [x] S12.17 Step 12 — build all element specs (video / cover / caption / audio / logo / SFX)
- [x] S12.18 Step 13 — assemble single `BatchCommand` with media + insert commands
- [x] S12.19 Step 14 — execute via `editor.command.execute({ command })`
- [ ] S12.20 ~~Mute original audio~~ → already handled by `isSourceAudioEnabled: false` on segment video elements
- [x] S12.21 Aggregate warnings (TTS-fast + missing SFX assets) + return `PipelineResult`
- [x] S12.22 AbortSignal threaded through every stage (`abortGuard()` + per-module `signal` param)
- [ ] S12.23 ~~Mock-everything orchestrator-flow test~~ → deferred to Stage 14 manual browser test (the orchestrator is integration glue; submodules already test-covered)
- [x] S12.24 Commit Stage 12

---

## STAGE 13 — UI Route `/cn-to-vi`

Goal: Single-purpose page wiring orchestrator to UI.

- [x] S13.1 Create `app/cn-to-vi/layout.tsx` (minimal)
- [x] S13.2 Create `app/cn-to-vi/page.tsx` (single-file, all components inline for v1)
- [x] S13.3 Profile switcher (Select + New + Delete)
- [x] S13.4 Upload zone (3 file slots)
- [x] S13.5-S13.7 ~~Granular validation~~ → relying on `<input accept>` and processMediaAssets validation; deferred to Stage 14
- [x] S13.8 Settings panel
- [x] S13.9 Cover color + opacity slider
- [x] S13.10 Caption font as text input (font-picker integration deferred to Stage 14)
- [x] S13.11 Logo settings (enabled / interval / avoid-caption)
- [x] S13.12 Segment settings (duration / scale / rotate / flip toggles)
- [x] S13.13 TTS toggle
- [x] S13.14 SFX enabled + density level + master gain
- [x] S13.15 Seed input (0 = random)
- [x] S13.16 Settings auto-save to active profile via `saveProfile`
- [x] S13.17 Inline `RunningView` with stage label + progress bar
- [x] S13.18 Inline `DoneView` collapsible warnings list
- [x] S13.19 "Process" button → `runCnToViPipeline`
- [x] S13.20 onProgress callback updates UI state
- [x] S13.21 "Open editor" button on success
- [x] S13.22 Error state with message; retry by re-clicking Process
- [x] S13.23 Cancel button calls AbortController.abort
- [x] S13.24 Commit Stage 13

---

## STAGE 14 — Polish + Manual Test

- [~] S14.1 `bun run lint` — cn-vi-auto/ has remaining stylistic violations
       (object-params rule, unsafe casts); typecheck and tests are clean.
       Documented in LIMITATIONS.md.
- [x] S14.2 `bun test` — 115 tests passing across 14 files
- [ ] S14.3 `bun run build:web` — deferred (requires browser runtime to validate
       worker bundling); UI route typechecks with 0 errors in cn-vi-auto/cn-to-vi
- [ ] S14.4–S14.9 Manual tests — checklist documented in LIMITATIONS.md;
       requires real video + SFX assets in a browser environment
- [x] S14.10 Document known limitations in `cn-vi-auto/LIMITATIONS.md`
- [x] S14.11 Update `cn-vi-auto/README.md` with usage + file map + entry point
- [x] S14.12 Commit Stage 14

---

## Self-check checklist for every commit

After each commit, run:

```bash
git diff --name-only HEAD~1 HEAD | grep -v -E '^(apps/web/src/cn-vi-auto/|apps/web/src/app/cn-to-vi/|apps/web/package\.json$|bun\.lock$|\.claude/)' && echo "ISOLATION VIOLATED" || echo "isolation OK"
```

If any file falls outside the namespace, **revert immediately**.

---

## Working agreement

- 1 step = 1 commit (or batch of 2-3 trivial steps when they're tightly related)
- Each commit message: `feat(cn-vi-auto): S{stage}.{step} short description`
- After each commit: append checkmark `[x]` here and push the file too
- If any step requires touching OpenCut code, **stop** and report — don't sneak it in
