import { describe, expect, test } from "bun:test";
import {
	ALL_ZONES,
	bboxesOverlap,
	getZoneRect,
	zoneOverlapsCaption,
} from "../zones";
import {
	computeLogoSlotTimes,
	captionBBoxesForSlot,
	pickZoneForSlot,
} from "../logo-placement";
import { createSeededRng } from "../random-utils";
import type { MatchedCue, LogoPlacementOptions } from "../types";

const CANVAS = { width: 1080, height: 1920 };

describe("getZoneRect", () => {
	test("places top-left logo near (padding, padding)", () => {
		const rect = getZoneRect({
			zone: "top-left",
			canvas: CANVAS,
			sizeRatio: 0.1,
			paddingRatio: 0.05,
		});
		expect(rect.x).toBeCloseTo(54, 5);
		expect(rect.y).toBeCloseTo(96, 5);
		expect(rect.width).toBeCloseTo(108, 5);
		expect(rect.height).toBeCloseTo(108, 5);
	});

	test("middle-center is centered on canvas", () => {
		const rect = getZoneRect({
			zone: "middle-center",
			canvas: CANVAS,
			sizeRatio: 0.1,
			paddingRatio: 0.05,
		});
		const cx = rect.x + rect.width / 2;
		const cy = rect.y + rect.height / 2;
		expect(cx).toBeCloseTo(540, 5);
		expect(cy).toBeCloseTo(960, 5);
	});

	test("bottom-right keeps logo inside canvas with padding", () => {
		const rect = getZoneRect({
			zone: "bottom-right",
			canvas: CANVAS,
			sizeRatio: 0.1,
			paddingRatio: 0.05,
		});
		expect(rect.x + rect.width).toBeLessThanOrEqual(CANVAS.width);
		expect(rect.y + rect.height).toBeLessThanOrEqual(CANVAS.height);
	});
});

describe("bboxesOverlap", () => {
	test("returns true for overlapping rectangles", () => {
		expect(
			bboxesOverlap({
				a: { x: 0, y: 0, width: 100, height: 100 },
				b: { x: 50, y: 50, width: 100, height: 100 },
			}),
		).toBe(true);
	});

	test("returns false for touching edges", () => {
		expect(
			bboxesOverlap({
				a: { x: 0, y: 0, width: 100, height: 100 },
				b: { x: 100, y: 0, width: 100, height: 100 },
			}),
		).toBe(false);
	});

	test("returns false for disjoint rectangles", () => {
		expect(
			bboxesOverlap({
				a: { x: 0, y: 0, width: 50, height: 50 },
				b: { x: 200, y: 200, width: 50, height: 50 },
			}),
		).toBe(false);
	});
});

describe("zoneOverlapsCaption", () => {
	test("flags bottom-center when caption sits at bottom", () => {
		const captionBBoxes = [
			{ x: 100, y: 1700, width: 880, height: 100 },
		];
		const zoneRect = getZoneRect({
			zone: "bottom-center",
			canvas: CANVAS,
			sizeRatio: 0.1,
			paddingRatio: 0.05,
		});
		expect(zoneOverlapsCaption({ zoneRect, captionBBoxes })).toBe(true);
	});

	test("does not flag top zones for bottom caption", () => {
		const captionBBoxes = [
			{ x: 100, y: 1700, width: 880, height: 100 },
		];
		const zoneRect = getZoneRect({
			zone: "top-right",
			canvas: CANVAS,
			sizeRatio: 0.1,
			paddingRatio: 0.05,
		});
		expect(zoneOverlapsCaption({ zoneRect, captionBBoxes })).toBe(false);
	});
});

describe("computeLogoSlotTimes", () => {
	test("splits duration into evenly-sized intervals", () => {
		const slots = computeLogoSlotTimes({
			totalDurationSec: 12,
			intervalSec: 5,
		});
		expect(slots).toEqual([
			{ startSec: 0, endSec: 5 },
			{ startSec: 5, endSec: 10 },
			{ startSec: 10, endSec: 12 },
		]);
	});

	test("returns empty for zero duration", () => {
		expect(
			computeLogoSlotTimes({ totalDurationSec: 0, intervalSec: 5 }),
		).toEqual([]);
	});
});

describe("captionBBoxesForSlot", () => {
	test("includes only cues that overlap the slot in time", () => {
		const cues: MatchedCue[] = [
			{
				text: "a",
				startTime: 0,
				duration: 2,
				bbox: { x: 0, y: 0, width: 10, height: 10 },
				bboxSource: "ocr",
			},
			{
				text: "b",
				startTime: 6,
				duration: 1,
				bbox: { x: 0, y: 100, width: 10, height: 10 },
				bboxSource: "ocr",
			},
		];
		const got = captionBBoxesForSlot({
			slot: { startSec: 5, endSec: 10 },
			cues,
		});
		expect(got).toHaveLength(1);
		expect(got[0]!.y).toBe(100);
	});
});

describe("pickZoneForSlot", () => {
	const baseOptions: LogoPlacementOptions = {
		enabled: true,
		intervalSec: 5,
		sizeRatio: 0.1,
		opacity: 0.7,
		avoidCaption: true,
		paddingRatio: 0.05,
	};

	test("avoids same zone twice in a row", () => {
		const rng = createSeededRng(42);
		const slot = { startSec: 0, endSec: 5 };
		const first = pickZoneForSlot({
			slot,
			cues: [],
			options: baseOptions,
			canvas: CANVAS,
			rng,
			previousZone: null,
		});
		const second = pickZoneForSlot({
			slot,
			cues: [],
			options: baseOptions,
			canvas: CANVAS,
			rng,
			previousZone: first,
		});
		expect(second).not.toBe(first);
	});

	test("falls back when all 9 zones overlap caption", () => {
		const rng = createSeededRng(1);
		const fullCanvasCue: MatchedCue = {
			text: "x",
			startTime: 0,
			duration: 5,
			bbox: { x: 0, y: 0, width: CANVAS.width, height: CANVAS.height },
			bboxSource: "ocr",
		};
		const zone = pickZoneForSlot({
			slot: { startSec: 0, endSec: 5 },
			cues: [fullCanvasCue],
			options: baseOptions,
			canvas: CANVAS,
			rng,
			previousZone: null,
		});
		expect(ALL_ZONES).toContain(zone);
	});

	test("returns deterministic output for same seed", () => {
		const a = pickZoneForSlot({
			slot: { startSec: 0, endSec: 5 },
			cues: [],
			options: baseOptions,
			canvas: CANVAS,
			rng: createSeededRng(7),
			previousZone: null,
		});
		const b = pickZoneForSlot({
			slot: { startSec: 0, endSec: 5 },
			cues: [],
			options: baseOptions,
			canvas: CANVAS,
			rng: createSeededRng(7),
			previousZone: null,
		});
		expect(a).toBe(b);
	});
});
