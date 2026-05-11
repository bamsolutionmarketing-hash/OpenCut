# SFX Licenses

This directory will hold royalty-free sound effects for the cn-vi-auto pipeline.
**Audio files are not bundled in this commit** — only the typed manifest. See
`manifest.ts` for the intended layout.

When adding files, follow this format:

| ID | File | Duration | Source URL | License |
|---|---|---|---|---|
| `happy-chime-1` | `emotion/happy-chime-1.mp3` | 1.4s | https://… | Pixabay |
| `text-pop-1` | `text/text-pop-1.mp3` | 0.3s | https://… | Pixabay |
| … | … | … | … | … |

## Acceptable license types

- **CC0** — public domain dedication, no attribution required.
- **Pixabay** — free for commercial use under the [Pixabay Content License](https://pixabay.com/service/license-summary/).
- **Mixkit** — free for commercial use under the [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree).

## Audio normalization

All assets should be:

- Mono
- MP3, ~96 kbps
- Normalized to **-16 LUFS** integrated loudness
- True-peak limited to **-1 dBFS**
- Trimmed to remove silence at start/end

## Folder layout

```
sfx/
├── library/
│   ├── emotion/
│   │   ├── happy-chime-1.mp3
│   │   └── …
│   ├── text/
│   │   └── …
│   └── transition/
│       └── …
├── manifest.ts
└── LICENSES.md          (this file)
```

The runtime serves audio from `apps/web/public/cn-vi-auto/sfx/` — so the
`library/` folder is symlinked or copied there at build time. Until files
are present, the SFX picker (Stage 10) skips missing assets and emits a
warning rather than failing the pipeline.
