# cn-vi-auto

Isolated namespace for the Chinese→Vietnamese auto-pipeline feature.

## Isolation Rule

This module is intentionally a **read-only consumer** of OpenCut.

- Do **not** edit any file outside `apps/web/src/cn-vi-auto/` or `apps/web/src/app/cn-to-vi/`.
- Only import OpenCut modules through their public exports.
- If a helper does not expose what you need, copy and adapt it inside this namespace.
- Removing this folder + the `app/cn-to-vi/` route + the `tesseract.js` dependency must restore OpenCut to its original state.

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
build-cover/caption/audio/logo/segment/sfx elements
        │
        ▼
BatchCommand → editor → export
```

Stages are documented in plan v5 (see project root conversation log).
