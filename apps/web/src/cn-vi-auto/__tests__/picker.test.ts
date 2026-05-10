import { describe, expect, test } from "bun:test";
import { createSeededRng } from "../random-utils";
import {
	limitSfxDensity,
	pickEmotionSfx,
	pickSfxForCues,
	pickSfxForSegmentBoundaries,
} from "../sfx/picker";
import type { ClassifiedCue, SfxOptions, SfxPick } from "../types";

const HEAVY_OPTIONS: SfxOptions = {
	enabled: true,
	level: "heavy",
	masterGain: 0.6,
	emotion: true,
	textAppear: true,
	punctuation: true,
	transition: true,
};

function classifiedCue({
	startTime,
	duration,
	text,
	emotions,
}: {
	startTime: number;
	duration: number;
	text: string;
	emotions: ClassifiedCue["emotions"];
}): ClassifiedCue {
	return {
		text,
		startTime,
		duration,
		bbox: { x: 0, y: 0, width: 100, height: 50 },
		bboxSource: "ocr",
		emotions,
	};
}

describe("pickEmotionSfx", () => {
	test("returns an asset whose tags include the emotion", () => {
		const rng = createSeededRng(1);
		const asset = pickEmotionSfx({
			emotion: "happy",
			rng,
			recent: [],
		});
		expect(asset).not.toBeNull();
		expect(asset!.tags).toContain("happy");
	});

	test("avoids recently used asset when alternatives exist", () => {
		const rng = createSeededRng(1);
		const first = pickEmotionSfx({ emotion: "happy", rng, recent: [] });
		const second = pickEmotionSfx({
			emotion: "happy",
			rng,
			recent: [first!.id],
		});
		expect(second!.id).not.toBe(first!.id);
	});
});

describe("pickSfxForCues", () => {
	test("returns no picks when level=off", () => {
		const cues = [
			classifiedCue({
				startTime: 0,
				duration: 2,
				text: "vui",
				emotions: ["happy"],
			}),
		];
		expect(
			pickSfxForCues({
				cues,
				options: { ...HEAVY_OPTIONS, level: "off" },
				rng: createSeededRng(1),
			}),
		).toEqual([]);
	});

	test("returns deterministic output for same seed", () => {
		const cues = [
			classifiedCue({
				startTime: 0,
				duration: 2,
				text: "vui",
				emotions: ["happy"],
			}),
			classifiedCue({
				startTime: 3,
				duration: 2,
				text: "buon",
				emotions: ["sad"],
			}),
		];
		const a = pickSfxForCues({
			cues,
			options: HEAVY_OPTIONS,
			rng: createSeededRng(7),
		});
		const b = pickSfxForCues({
			cues,
			options: HEAVY_OPTIONS,
			rng: createSeededRng(7),
		});
		expect(a.map((p) => p.asset.id)).toEqual(b.map((p) => p.asset.id));
	});

	test("output is sorted by startSec", () => {
		const cues = Array.from({ length: 20 }, (_, i) =>
			classifiedCue({
				startTime: i * 2,
				duration: 1.5,
				text: "vui",
				emotions: ["happy"],
			}),
		);
		const picks = pickSfxForCues({
			cues,
			options: HEAVY_OPTIONS,
			rng: createSeededRng(99),
		});
		for (let i = 1; i < picks.length; i++) {
			expect(picks[i]!.startSec).toBeGreaterThanOrEqual(picks[i - 1]!.startSec);
		}
	});

	test("multiplies gain by masterGain", () => {
		const cues = [
			classifiedCue({
				startTime: 0,
				duration: 2,
				text: "vui",
				emotions: ["happy"],
			}),
		];
		const picks = pickSfxForCues({
			cues,
			options: { ...HEAVY_OPTIONS, masterGain: 0.5 },
			rng: createSeededRng(1),
		});
		for (const p of picks) {
			expect(p.gain).toBeCloseTo(p.asset.defaultGain * 0.5, 5);
		}
	});
});

describe("pickSfxForSegmentBoundaries", () => {
	test("skips the boundary at t=0", () => {
		const picks = pickSfxForSegmentBoundaries({
			boundaries: [{ startSec: 0 }, { startSec: 5 }, { startSec: 10 }],
			options: HEAVY_OPTIONS,
			rng: createSeededRng(1),
		});
		for (const p of picks) {
			expect(p.startSec).toBeGreaterThan(-2);
		}
		// If anything is picked, none should originate from t=0 boundary.
		for (const p of picks) {
			// SFX may start slightly negative due to centering on boundary.
			// But boundary at 0 → start ≈ -duration/2; we skipped it, so no
			// picks should have startSec < 0.
			expect(p.startSec).toBeGreaterThanOrEqual(0);
		}
	});

	test("returns nothing when transition flag is off", () => {
		expect(
			pickSfxForSegmentBoundaries({
				boundaries: [{ startSec: 5 }],
				options: { ...HEAVY_OPTIONS, transition: false },
				rng: createSeededRng(1),
			}),
		).toEqual([]);
	});
});

describe("limitSfxDensity", () => {
	const a = (id: string, startSec: number, dur: number): SfxPick => ({
		asset: {
			id,
			file: "x",
			durationSec: dur,
			defaultGain: 0.6,
			category: "emotion",
			tags: [],
			source: "x",
			license: "CC0",
		},
		startSec,
		gain: 0.6,
	});

	test("drops picks beyond maxConcurrent overlap", () => {
		const picks = [a("a", 0, 2), a("b", 0.5, 2), a("c", 1.0, 2)];
		const limited = limitSfxDensity({ picks, maxConcurrent: 2 });
		expect(limited.map((p) => p.asset.id)).toEqual(["a", "b"]);
	});

	test("admits non-overlapping picks", () => {
		const picks = [a("a", 0, 1), a("b", 1.5, 1), a("c", 3, 1)];
		const limited = limitSfxDensity({ picks, maxConcurrent: 1 });
		expect(limited.map((p) => p.asset.id)).toEqual(["a", "b", "c"]);
	});
});
