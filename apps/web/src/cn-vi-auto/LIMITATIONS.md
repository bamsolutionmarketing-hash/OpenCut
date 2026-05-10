# cn-vi-auto — known limitations

This document tracks items deferred from the v1 build of the Chinese →
Vietnamese auto-pipeline. None of them block the happy path; they are
recorded so future work has a starting list.

## Audio assets

- **SFX library not bundled.** `sfx/manifest.ts` declares 49 typed
  entries but the actual MP3 files are not committed. The orchestrator
  skip-and-warns for missing assets so the pipeline still runs.
  Populate `apps/web/public/cn-vi-auto/sfx/{emotion,text,transition}/`
  with normalized files (mono, ~96 kbps, -16 LUFS) per `sfx/LICENSES.md`.

## Pipeline behavior

- **Zoom-mode keyframes deferred.** `SegmentInstance.zoomMode` is rolled
  per segment and stored, but only `static` is rendered in v1 — keyframe
  generation for `slow-in`, `slow-out`, `ken-burns` is not wired. The
  data is there; renderer integration is next.
- **OCR + TTS load run sequentially.** A small latency win is available
  by starting TTS model download in parallel with OCR. Skipped to keep
  the orchestrator readable.
- **Mute original audio.** The plan called for explicit `mute_original`
  handling; we instead set `isSourceAudioEnabled: false` on every
  segment video element, which has the same effect. Toggling it back on
  per profile is not yet exposed in the UI.
- **Manual orchestrator-flow test deferred.** Submodules are unit-tested
  (115 tests); the orchestrator itself is integration glue and is best
  validated by Stage 14 manual browser runs.

## Classifier coverage

- The Vietnamese keyword list is a starter set (~70 keywords across
  9 emotion categories). It will miss colloquial spellings, slang, and
  region-specific phrases. Add keywords to `sfx/keywords-vi.ts` as
  videos surface gaps — no other code changes needed.
- Negation handling is a 30-char-window heuristic. Sentences with
  intervening clauses can confuse it (e.g. *"không phải vì tôi không vui
  mà…"*).

## UI gaps

- Caption font picker is a plain text input. Wire OpenCut's
  `font-picker.tsx` for parity.
- No retry button on the error state — clicking Process again works but
  isn't labeled.
- Profile rename / duplicate UI is missing (only New / Delete).
- Validation: file inputs trust `<input accept>` and OpenCut's
  `processMediaAssets` validation. No size cap or codec preflight.

## Linting

The OpenCut codebase enforces `opencut/prefer-object-params` and
`@typescript-eslint/no-unsafe-type-assertion` project-wide. A handful
of ergonomic violations remain in `cn-vi-auto/` (`pcm`, `sampleRate`
positional params in WAV writer; cast for Tesseract page shape; etc.).
Tests pass; types are sound. Address by sweeping the namespace with
`eslint --fix` plus a small batch of object-param refactors in a
follow-up.

## Manual test checklist

Run these after dropping real SFX files in:

1. 10s clip, no TTS, no SFX, no logo
2. 10s clip with TTS only
3. 30s clip with TTS + cover + caption
4. 30s clip with logo + segment variation
5. 30s clip with SFX (medium density)
6. Full 60s clip end-to-end
7. Profile save / load / switch / delete
8. Cancel mid-pipeline, restart with same inputs
