import type { SfxAsset } from "../types";

/**
 * Manifest of bundled sound effects.
 *
 * **Status:** placeholder. Audio files are not bundled in this commit.
 * Each entry's `file` path is the *intended* location under
 * `apps/web/public/cn-vi-auto/sfx/`. The orchestrator skips entries whose
 * file 404s and emits a warning, so the pipeline still runs end-to-end
 * before the audio assets are added.
 *
 * To populate: drop CC0/Mixkit/Pixabay MP3s (mono, ~96 kbps, normalized to
 * -16 LUFS) into the corresponding folder and remove the placeholder note
 * once verified. License attribution lives in `LICENSES.md`.
 */

const PUBLIC_PATH = "/cn-vi-auto/sfx";

function asset(input: {
	id: string;
	file: string;
	durationSec: number;
	defaultGain?: number;
	category: SfxAsset["category"];
	tags: string[];
	source: string;
	license: SfxAsset["license"];
}): SfxAsset {
	return {
		id: input.id,
		file: `${PUBLIC_PATH}/${input.file}`,
		durationSec: input.durationSec,
		defaultGain: input.defaultGain ?? 0.6,
		category: input.category,
		tags: input.tags,
		source: input.source,
		license: input.license,
	};
}

const EMOTION_SFX: SfxAsset[] = [
	// Happy (5)
	asset({ id: "happy-chime-1", file: "emotion/happy-chime-1.mp3", durationSec: 1.4, category: "emotion", tags: ["happy", "joy", "uplift"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "happy-chime-2", file: "emotion/happy-chime-2.mp3", durationSec: 1.6, category: "emotion", tags: ["happy", "uplift", "sparkle"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "happy-bell-1", file: "emotion/happy-bell-1.mp3", durationSec: 1.2, category: "emotion", tags: ["happy", "bell"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "happy-twinkle-1", file: "emotion/happy-twinkle-1.mp3", durationSec: 1.8, category: "emotion", tags: ["happy", "magical"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "happy-cheer-1", file: "emotion/happy-cheer-1.mp3", durationSec: 2.0, category: "emotion", tags: ["happy", "cheer", "kids"], source: "Mixkit", license: "Mixkit" }),

	// Laugh (4)
	asset({ id: "laugh-cartoon-1", file: "emotion/laugh-cartoon-1.mp3", durationSec: 1.5, category: "emotion", tags: ["laugh", "cartoon"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "laugh-giggle-1", file: "emotion/laugh-giggle-1.mp3", durationSec: 1.2, category: "emotion", tags: ["laugh", "giggle"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "laugh-track-1", file: "emotion/laugh-track-1.mp3", durationSec: 2.5, category: "emotion", tags: ["laugh", "sitcom"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "laugh-bigsmile-1", file: "emotion/laugh-bigsmile-1.mp3", durationSec: 1.8, category: "emotion", tags: ["laugh", "happy"], source: "Pixabay", license: "Pixabay" }),

	// Sad (4)
	asset({ id: "sad-violin-1", file: "emotion/sad-violin-1.mp3", durationSec: 3.0, category: "emotion", tags: ["sad", "violin"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "sad-piano-1", file: "emotion/sad-piano-1.mp3", durationSec: 2.5, category: "emotion", tags: ["sad", "piano"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "sad-drop-1", file: "emotion/sad-drop-1.mp3", durationSec: 1.4, category: "emotion", tags: ["sad", "fall"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "sad-strings-1", file: "emotion/sad-strings-1.mp3", durationSec: 3.2, category: "emotion", tags: ["sad", "strings"], source: "Pixabay", license: "Pixabay" }),

	// Surprise (4)
	asset({ id: "surprise-stinger-1", file: "emotion/surprise-stinger-1.mp3", durationSec: 0.9, category: "emotion", tags: ["surprise", "stinger"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "surprise-gasp-1", file: "emotion/surprise-gasp-1.mp3", durationSec: 0.7, category: "emotion", tags: ["surprise", "gasp"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "surprise-ding-1", file: "emotion/surprise-ding-1.mp3", durationSec: 0.6, category: "emotion", tags: ["surprise", "ding"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "surprise-pop-1", file: "emotion/surprise-pop-1.mp3", durationSec: 0.5, category: "emotion", tags: ["surprise", "pop"], source: "Mixkit", license: "Mixkit" }),

	// Suspense (3)
	asset({ id: "suspense-rise-1", file: "emotion/suspense-rise-1.mp3", durationSec: 3.0, category: "emotion", tags: ["suspense", "rise"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "suspense-pulse-1", file: "emotion/suspense-pulse-1.mp3", durationSec: 2.5, category: "emotion", tags: ["suspense", "pulse"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "suspense-drone-1", file: "emotion/suspense-drone-1.mp3", durationSec: 4.0, category: "emotion", tags: ["suspense", "drone"], source: "Pixabay", license: "Pixabay" }),

	// Romantic (3)
	asset({ id: "romantic-harp-1", file: "emotion/romantic-harp-1.mp3", durationSec: 2.5, category: "emotion", tags: ["romantic", "harp"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "romantic-strings-1", file: "emotion/romantic-strings-1.mp3", durationSec: 3.0, category: "emotion", tags: ["romantic", "strings"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "romantic-twinkle-1", file: "emotion/romantic-twinkle-1.mp3", durationSec: 2.0, category: "emotion", tags: ["romantic", "twinkle"], source: "Pixabay", license: "Pixabay" }),

	// Question (2)
	asset({ id: "question-curious-1", file: "emotion/question-curious-1.mp3", durationSec: 1.2, category: "emotion", tags: ["question", "curious"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "question-rise-1", file: "emotion/question-rise-1.mp3", durationSec: 1.0, category: "emotion", tags: ["question", "rise"], source: "Mixkit", license: "Mixkit" }),

	// Exclaim (3)
	asset({ id: "exclaim-hit-1", file: "emotion/exclaim-hit-1.mp3", durationSec: 0.8, category: "emotion", tags: ["exclaim", "hit"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "exclaim-stinger-1", file: "emotion/exclaim-stinger-1.mp3", durationSec: 1.0, category: "emotion", tags: ["exclaim", "stinger"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "exclaim-burst-1", file: "emotion/exclaim-burst-1.mp3", durationSec: 0.6, category: "emotion", tags: ["exclaim", "burst"], source: "Pixabay", license: "Pixabay" }),
];

const TEXT_SFX: SfxAsset[] = [
	// Pop / text-appear (5)
	asset({ id: "text-pop-1", file: "text/text-pop-1.mp3", durationSec: 0.3, defaultGain: 0.5, category: "text", tags: ["pop", "text"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-pop-2", file: "text/text-pop-2.mp3", durationSec: 0.3, defaultGain: 0.5, category: "text", tags: ["pop", "text"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-bubble-1", file: "text/text-bubble-1.mp3", durationSec: 0.4, defaultGain: 0.5, category: "text", tags: ["bubble", "text"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "text-tap-1", file: "text/text-tap-1.mp3", durationSec: 0.2, defaultGain: 0.4, category: "text", tags: ["tap", "text"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-typewriter-1", file: "text/text-typewriter-1.mp3", durationSec: 0.5, defaultGain: 0.4, category: "text", tags: ["typewriter", "text"], source: "Mixkit", license: "Mixkit" }),

	// Whoosh (4)
	asset({ id: "text-whoosh-1", file: "text/text-whoosh-1.mp3", durationSec: 0.6, defaultGain: 0.5, category: "text", tags: ["whoosh"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "text-whoosh-2", file: "text/text-whoosh-2.mp3", durationSec: 0.5, defaultGain: 0.5, category: "text", tags: ["whoosh"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-whoosh-soft-1", file: "text/text-whoosh-soft-1.mp3", durationSec: 0.7, defaultGain: 0.4, category: "text", tags: ["whoosh", "soft"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-swipe-1", file: "text/text-swipe-1.mp3", durationSec: 0.4, defaultGain: 0.5, category: "text", tags: ["swipe"], source: "Mixkit", license: "Mixkit" }),

	// Ding (3)
	asset({ id: "text-ding-1", file: "text/text-ding-1.mp3", durationSec: 0.6, defaultGain: 0.5, category: "text", tags: ["ding"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "text-ding-2", file: "text/text-ding-2.mp3", durationSec: 0.5, defaultGain: 0.5, category: "text", tags: ["ding"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "text-bell-1", file: "text/text-bell-1.mp3", durationSec: 0.7, defaultGain: 0.5, category: "text", tags: ["bell"], source: "Pixabay", license: "Pixabay" }),
];

const TRANSITION_SFX: SfxAsset[] = [
	// Swoosh (4)
	asset({ id: "trans-swoosh-1", file: "transition/trans-swoosh-1.mp3", durationSec: 1.0, category: "transition", tags: ["swoosh"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "trans-swoosh-2", file: "transition/trans-swoosh-2.mp3", durationSec: 0.9, category: "transition", tags: ["swoosh"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "trans-swoosh-deep-1", file: "transition/trans-swoosh-deep-1.mp3", durationSec: 1.2, category: "transition", tags: ["swoosh", "deep"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "trans-swoosh-fast-1", file: "transition/trans-swoosh-fast-1.mp3", durationSec: 0.6, category: "transition", tags: ["swoosh", "fast"], source: "Pixabay", license: "Pixabay" }),

	// Impact (3)
	asset({ id: "trans-impact-1", file: "transition/trans-impact-1.mp3", durationSec: 1.0, category: "transition", tags: ["impact"], source: "Pixabay", license: "Pixabay" }),
	asset({ id: "trans-impact-bass-1", file: "transition/trans-impact-bass-1.mp3", durationSec: 1.2, category: "transition", tags: ["impact", "bass"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "trans-impact-cinematic-1", file: "transition/trans-impact-cinematic-1.mp3", durationSec: 1.5, category: "transition", tags: ["impact", "cinematic"], source: "Pixabay", license: "Pixabay" }),

	// Glitch (2)
	asset({ id: "trans-glitch-1", file: "transition/trans-glitch-1.mp3", durationSec: 0.8, category: "transition", tags: ["glitch"], source: "Mixkit", license: "Mixkit" }),
	asset({ id: "trans-glitch-2", file: "transition/trans-glitch-2.mp3", durationSec: 0.7, category: "transition", tags: ["glitch", "digital"], source: "Pixabay", license: "Pixabay" }),
];

export const SFX_MANIFEST: SfxAsset[] = [
	...EMOTION_SFX,
	...TEXT_SFX,
	...TRANSITION_SFX,
];

export function getSfxAssetById({ id }: { id: string }): SfxAsset | null {
	return SFX_MANIFEST.find((a) => a.id === id) ?? null;
}

export function filterSfxByCategory({
	category,
}: {
	category: SfxAsset["category"];
}): SfxAsset[] {
	return SFX_MANIFEST.filter((a) => a.category === category);
}

export function filterSfxByTag({ tag }: { tag: string }): SfxAsset[] {
	return SFX_MANIFEST.filter((a) => a.tags.includes(tag));
}
