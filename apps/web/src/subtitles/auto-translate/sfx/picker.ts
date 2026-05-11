import type { SeededRng } from "../random-utils";
import type {
	ClassifiedCue,
	EmotionTag,
	SfxAsset,
	SfxLevel,
	SfxOptions,
	SfxPick,
} from "../types";
import { filterSfxByCategory, filterSfxByTag } from "./manifest";

const RECENT_HISTORY = 4;

/** Probability per cue that we add an SFX cue, indexed by level. */
const CUE_DENSITY: Record<SfxLevel, number> = {
	off: 0,
	light: 0.3,
	medium: 0.6,
	heavy: 0.9,
};

/** Probability per segment boundary that we add a transition SFX. */
const TRANSITION_DENSITY: Record<SfxLevel, number> = {
	off: 0,
	light: 0.2,
	medium: 0.5,
	heavy: 0.8,
};

/** Pick an SFX whose tag matches `emotion`, avoiding `recent` ids. */
export function pickEmotionSfx({
	emotion,
	rng,
	recent,
}: {
	emotion: EmotionTag;
	rng: SeededRng;
	recent: string[];
}): SfxAsset | null {
	const matches = filterSfxByTag({ tag: emotion });
	if (matches.length === 0) return null;
	const filtered = matches.filter((a) => !recent.includes(a.id));
	const pool = filtered.length > 0 ? filtered : matches;
	return rng.pick(pool);
}

/** Pick a transition SFX (swoosh / impact / glitch). */
export function pickTransitionSfx({
	rng,
	recent,
}: {
	rng: SeededRng;
	recent: string[];
}): SfxAsset | null {
	const all = filterSfxByCategory({ category: "transition" });
	if (all.length === 0) return null;
	const filtered = all.filter((a) => !recent.includes(a.id));
	const pool = filtered.length > 0 ? filtered : all;
	return rng.pick(pool);
}

/** Pick a text-appear SFX (pop / whoosh / ding). */
export function pickTextSfx({
	rng,
	recent,
}: {
	rng: SeededRng;
	recent: string[];
}): SfxAsset | null {
	const all = filterSfxByCategory({ category: "text" });
	if (all.length === 0) return null;
	const filtered = all.filter((a) => !recent.includes(a.id));
	const pool = filtered.length > 0 ? filtered : all;
	return rng.pick(pool);
}

interface RecentTracker {
	push(id: string): void;
	ids(): string[];
}

function createRecentTracker(): RecentTracker {
	const buf: string[] = [];
	return {
		push(id) {
			buf.push(id);
			if (buf.length > RECENT_HISTORY) buf.shift();
		},
		ids() {
			return buf.slice();
		},
	};
}

/**
 * Decide SFX for every cue. Each cue may yield zero, one, or two picks:
 *   - one `text` SFX at cue start (when `options.textAppear` && density passes)
 *   - one `emotion` SFX a beat later (when `options.emotion` && density passes)
 *
 * Picks are returned sorted by `startSec`.
 */
export function pickSfxForCues({
	cues,
	options,
	rng,
}: {
	cues: ClassifiedCue[];
	options: SfxOptions;
	rng: SeededRng;
}): SfxPick[] {
	if (!options.enabled || options.level === "off") return [];

	const density = CUE_DENSITY[options.level];
	const recentText = createRecentTracker();
	const recentEmotion = createRecentTracker();
	const out: SfxPick[] = [];

	for (let i = 0; i < cues.length; i++) {
		const cue = cues[i]!;
		const cueRng = rng.fork(i + 1);

		if (options.textAppear && cueRng.bool(density)) {
			const asset = pickTextSfx({ rng: cueRng, recent: recentText.ids() });
			if (asset) {
				recentText.push(asset.id);
				out.push({
					asset,
					startSec: cue.startTime,
					gain: asset.defaultGain * options.masterGain,
				});
			}
		}

		if (options.emotion) {
			const meaningful = cue.emotions.filter((e) => e !== "neutral");
			if (
				meaningful.length > 0 &&
				cueRng.bool(density) &&
				(options.punctuation ||
					(!cue.emotions.includes("question") &&
						!cue.emotions.includes("exclaim")))
			) {
				const tag = cueRng.pick(meaningful);
				const asset = pickEmotionSfx({
					emotion: tag,
					rng: cueRng,
					recent: recentEmotion.ids(),
				});
				if (asset) {
					recentEmotion.push(asset.id);
					out.push({
						asset,
						startSec: cue.startTime + Math.min(0.3, cue.duration / 4),
						gain: asset.defaultGain * options.masterGain,
					});
				}
			}
		}
	}

	return out.sort((a, b) => a.startSec - b.startSec);
}

/** Pick transition SFX at segment boundaries (skip the first boundary at t=0). */
export function pickSfxForSegmentBoundaries({
	boundaries,
	options,
	rng,
}: {
	boundaries: { startSec: number }[];
	options: SfxOptions;
	rng: SeededRng;
}): SfxPick[] {
	if (!options.enabled || !options.transition || options.level === "off") {
		return [];
	}
	const density = TRANSITION_DENSITY[options.level];
	const recent = createRecentTracker();
	const out: SfxPick[] = [];
	for (let i = 0; i < boundaries.length; i++) {
		const b = boundaries[i]!;
		if (b.startSec <= 0) continue;
		const boundaryRng = rng.fork(1000 + i);
		if (!boundaryRng.bool(density)) continue;
		const asset = pickTransitionSfx({
			rng: boundaryRng,
			recent: recent.ids(),
		});
		if (!asset) continue;
		recent.push(asset.id);
		out.push({
			asset,
			startSec: b.startSec - asset.durationSec / 2,
			gain: asset.defaultGain * options.masterGain,
		});
	}
	return out;
}

/** Combine cue + transition picks and enforce a max of `maxConcurrent` overlapping SFX. */
export function limitSfxDensity({
	picks,
	maxConcurrent = 2,
}: {
	picks: SfxPick[];
	maxConcurrent?: number;
}): SfxPick[] {
	const sorted = picks.slice().sort((a, b) => a.startSec - b.startSec);
	const accepted: SfxPick[] = [];
	for (const pick of sorted) {
		const overlapping = accepted.filter((p) => {
			const pEnd = p.startSec + p.asset.durationSec;
			return pick.startSec < pEnd;
		});
		if (overlapping.length < maxConcurrent) accepted.push(pick);
	}
	return accepted;
}
