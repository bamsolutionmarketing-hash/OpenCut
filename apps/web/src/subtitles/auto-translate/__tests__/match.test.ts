import { describe, expect, test } from "bun:test";
import {
	framesInTimeRange,
	matchAllCues,
	medianBBox,
	mergeBoxesPerFrame,
	padBBox,
} from "../match";
import { computeDefaultZone } from "../default-zone";
import type { OcrBox, OcrFrame } from "../types";

const CANVAS = { width: 1080, height: 1920 };

function box({
	x,
	y,
	w,
	h,
	text = "你好",
	conf = 80,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	text?: string;
	conf?: number;
}): OcrBox {
	return {
		bbox: { x, y, width: w, height: h },
		polygon: [],
		text,
		confidence: conf,
	};
}

describe("framesInTimeRange", () => {
	test("includes frames within [start, end] inclusive", () => {
		const frames: OcrFrame[] = [
			{ timeSec: 0.5, boxes: [] },
			{ timeSec: 1.2, boxes: [] },
			{ timeSec: 1.8, boxes: [] },
			{ timeSec: 3.1, boxes: [] },
		];
		const got = framesInTimeRange({
			frames,
			startSec: 1.0,
			endSec: 2.0,
		});
		expect(got.map((f) => f.timeSec)).toEqual([1.2, 1.8]);
	});
});

describe("mergeBoxesPerFrame", () => {
	test("merges vertically adjacent lines into one bbox", () => {
		const boxes = [
			box({ x: 100, y: 1500, w: 800, h: 60 }),
			box({ x: 120, y: 1565, w: 760, h: 60 }),
		];
		const merged = mergeBoxesPerFrame({
			boxes,
			mergeVerticalGapRatio: 0.5,
		});
		expect(merged.length).toBe(1);
		expect(merged[0]!.x).toBe(100);
		expect(merged[0]!.y).toBe(1500);
		expect(merged[0]!.height).toBe(125);
	});

	test("keeps far-apart boxes separate", () => {
		const boxes = [
			box({ x: 100, y: 200, w: 200, h: 50 }),
			box({ x: 100, y: 1500, w: 200, h: 50 }),
		];
		const merged = mergeBoxesPerFrame({
			boxes,
			mergeVerticalGapRatio: 0.5,
		});
		expect(merged.length).toBe(2);
	});
});

describe("medianBBox", () => {
	test("returns null for empty input", () => {
		expect(medianBBox({ bboxes: [] })).toBeNull();
	});

	test("computes per-axis median", () => {
		const result = medianBBox({
			bboxes: [
				{ x: 100, y: 1500, width: 800, height: 60 },
				{ x: 110, y: 1505, width: 790, height: 65 },
				{ x: 90, y: 1495, width: 810, height: 55 },
			],
		});
		expect(result).toEqual({ x: 100, y: 1500, width: 800, height: 60 });
	});
});

describe("padBBox", () => {
	test("expands by ratio and clamps to canvas", () => {
		const out = padBBox({
			bbox: { x: 100, y: 1500, width: 800, height: 60 },
			paddingRatio: 0.1,
			canvas: CANVAS,
		});
		expect(out.x).toBe(20);
		expect(out.y).toBe(1494);
		expect(out.width).toBe(960);
		expect(out.height).toBe(72);
	});

	test("clamps right/bottom edges to canvas size", () => {
		const out = padBBox({
			bbox: { x: 1000, y: 1900, width: 100, height: 40 },
			paddingRatio: 0.5,
			canvas: CANVAS,
		});
		expect(out.x + out.width).toBeLessThanOrEqual(CANVAS.width);
		expect(out.y + out.height).toBeLessThanOrEqual(CANVAS.height);
	});
});

describe("matchAllCues", () => {
	function makeCue({
		startTime,
		duration,
		text,
	}: {
		startTime: number;
		duration: number;
		text: string;
	}) {
		return {
			startTime,
			duration,
			text,
			endTime: startTime + duration,
		};
	}

	test("uses median bbox when OCR data is present in cue range", () => {
		const cues = [
			makeCue({ startTime: 1.0, duration: 2.0, text: "Xin chào" }),
		];
		const ocrFrames: OcrFrame[] = [
			{
				timeSec: 1.5,
				boxes: [box({ x: 100, y: 1500, w: 800, h: 60 })],
			},
			{
				timeSec: 2.0,
				boxes: [box({ x: 110, y: 1500, w: 800, h: 60 })],
			},
			{
				timeSec: 2.5,
				boxes: [box({ x: 90, y: 1500, w: 800, h: 60 })],
			},
		];
		const matched = matchAllCues({
			cues,
			ocrFrames,
			options: { canvas: CANVAS, paddingRatio: 0 },
		});
		expect(matched[0]!.bboxSource).toBe("ocr");
		expect(matched[0]!.bbox.x).toBe(100);
	});

	test("falls back to default zone when no OCR + no neighbor", () => {
		const cues = [
			makeCue({ startTime: 1.0, duration: 1.0, text: "Test" }),
		];
		const matched = matchAllCues({
			cues,
			ocrFrames: [],
			options: { canvas: CANVAS },
		});
		expect(matched[0]!.bboxSource).toBe("default-zone");
		const expected = computeDefaultZone({ canvas: CANVAS });
		expect(matched[0]!.bbox).toEqual(expected);
	});

	test("uses nearest neighbor bbox when within window", () => {
		const cues = [
			makeCue({ startTime: 1.0, duration: 1.0, text: "A" }),
			makeCue({ startTime: 2.5, duration: 1.0, text: "B" }),
		];
		const ocrFrames: OcrFrame[] = [
			{
				timeSec: 1.5,
				boxes: [box({ x: 100, y: 1500, w: 800, h: 60 })],
			},
		];
		const matched = matchAllCues({
			cues,
			ocrFrames,
			options: { canvas: CANVAS, paddingRatio: 0 },
		});
		expect(matched[0]!.bboxSource).toBe("ocr");
		expect(matched[1]!.bboxSource).toBe("nearest-neighbor");
		expect(matched[1]!.bbox.x).toBe(100);
	});
});
