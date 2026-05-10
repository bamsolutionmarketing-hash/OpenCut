import { describe, expect, test } from "bun:test";
import {
	buildSegmentInstances,
	computeSegmentBoundaries,
	paramsFromSegment,
	pickTransformsForSegment,
} from "../segment-variation";
import { createSeededRng } from "../random-utils";
import type {
	MatchedCue,
	SegmentInstance,
	SegmentTransformOptions,
} from "../types";

const CANVAS = { width: 1080, height: 1920 };

function cue({
	startTime,
	duration,
}: {
	startTime: number;
	duration: number;
}): MatchedCue {
	return {
		text: "x",
		startTime,
		duration,
		bbox: { x: 100, y: 1500, width: 880, height: 100 },
		bboxSource: "ocr",
	};
}

const NULL_OPTIONS: SegmentTransformOptions = {
	durationSec: 15,
	scale: { enabled: false, min: 1, max: 1 },
	zoom: { enabled: false, modes: ["static"] },
	flip: { enabled: false, probability: 0 },
	rotate: { enabled: false, minDeg: 0, maxDeg: 0 },
	cropX: { enabled: false, range: 0 },
	cropY: { enabled: false, range: 0 },
	speed: { enabled: false, min: 1, max: 1 },
};

describe("computeSegmentBoundaries", () => {
	test("splits evenly when no cues block boundaries", () => {
		const out = computeSegmentBoundaries({
			totalDurationSec: 30,
			segmentDurationSec: 10,
			cues: [],
		});
		expect(out).toEqual([
			{ startSec: 0, endSec: 10, containsCue: false },
			{ startSec: 10, endSec: 20, containsCue: false },
			{ startSec: 20, endSec: 30, containsCue: false },
		]);
	});

	test("snaps boundary forward to cue end when cut would split a cue", () => {
		const out = computeSegmentBoundaries({
			totalDurationSec: 30,
			segmentDurationSec: 10,
			cues: [cue({ startTime: 8, duration: 5 })],
		});
		// First boundary would be at 10 — splits cue [8, 13]. Snap to 13.
		expect(out[0]!.endSec).toBe(13);
		expect(out[0]!.containsCue).toBe(true);
	});

	test("flags segments whose time range overlaps a cue", () => {
		const out = computeSegmentBoundaries({
			totalDurationSec: 30,
			segmentDurationSec: 10,
			cues: [cue({ startTime: 22, duration: 1 })],
		});
		expect(out[2]!.containsCue).toBe(true);
		expect(out[0]!.containsCue).toBe(false);
	});
});

describe("pickTransformsForSegment", () => {
	test("returns identity transforms when all options disabled", () => {
		const seg = pickTransformsForSegment({
			index: 0,
			startSec: 0,
			endSec: 5,
			containsCue: false,
			options: NULL_OPTIONS,
			rng: createSeededRng(1),
		});
		expect(seg.scale).toBe(1);
		expect(seg.flip).toBe(false);
		expect(seg.rotateDeg).toBe(0);
		expect(seg.speed).toBe(1);
		expect(seg.zoomMode).toBe("static");
	});

	test("never flips a segment containing a cue", () => {
		const seg = pickTransformsForSegment({
			index: 0,
			startSec: 0,
			endSec: 5,
			containsCue: true,
			options: {
				...NULL_OPTIONS,
				flip: { enabled: true, probability: 1 },
			},
			rng: createSeededRng(1),
		});
		expect(seg.flip).toBe(false);
	});

	test("flips when allowed and probability is 1", () => {
		const seg = pickTransformsForSegment({
			index: 0,
			startSec: 0,
			endSec: 5,
			containsCue: false,
			options: {
				...NULL_OPTIONS,
				flip: { enabled: true, probability: 1 },
			},
			rng: createSeededRng(1),
		});
		expect(seg.flip).toBe(true);
	});

	test("scale and rotate fall within the configured range", () => {
		const seg = pickTransformsForSegment({
			index: 0,
			startSec: 0,
			endSec: 5,
			containsCue: false,
			options: {
				...NULL_OPTIONS,
				scale: { enabled: true, min: 1.05, max: 1.1 },
				rotate: { enabled: true, minDeg: -2, maxDeg: 2 },
			},
			rng: createSeededRng(1),
		});
		expect(seg.scale).toBeGreaterThanOrEqual(1.05);
		expect(seg.scale).toBeLessThanOrEqual(1.1);
		expect(seg.rotateDeg).toBeGreaterThanOrEqual(-2);
		expect(seg.rotateDeg).toBeLessThanOrEqual(2);
	});
});

describe("paramsFromSegment", () => {
	const baseSegment: SegmentInstance = {
		index: 0,
		startSec: 0,
		endSec: 5,
		flip: false,
		rotateDeg: 0,
		scale: 1,
		zoomMode: "static",
		cropOffsetX: 0,
		cropOffsetY: 0,
		speed: 1,
		containsCue: false,
	};

	test("flip becomes negative scaleX", () => {
		const params = paramsFromSegment({
			segment: { ...baseSegment, flip: true, scale: 1.05 },
			canvas: CANVAS,
		});
		expect(params["transform.scaleX"]).toBeCloseTo(-1.05, 5);
		expect(params["transform.scaleY"]).toBeCloseTo(1.05, 5);
	});

	test("crop offsets multiply by canvas dimensions", () => {
		const params = paramsFromSegment({
			segment: { ...baseSegment, cropOffsetX: 0.02, cropOffsetY: -0.01 },
			canvas: CANVAS,
		});
		expect(params["transform.positionX"]).toBeCloseTo(21.6, 5);
		expect(params["transform.positionY"]).toBeCloseTo(-19.2, 5);
	});
});

describe("buildSegmentInstances", () => {
	test("emits one instance per boundary with deterministic transforms", () => {
		const a = buildSegmentInstances({
			cues: [],
			options: {
				...NULL_OPTIONS,
				scale: { enabled: true, min: 1.02, max: 1.08 },
			},
			totalDurationSec: 45,
			rng: createSeededRng(99),
		});
		const b = buildSegmentInstances({
			cues: [],
			options: {
				...NULL_OPTIONS,
				scale: { enabled: true, min: 1.02, max: 1.08 },
			},
			totalDurationSec: 45,
			rng: createSeededRng(99),
		});
		expect(a.length).toBe(3);
		expect(a.map((s) => s.scale)).toEqual(b.map((s) => s.scale));
	});
});
