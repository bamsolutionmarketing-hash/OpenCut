import { describe, expect, test } from "bun:test";
import {
	computeDownscaledRoiSize,
	computeRoiRect,
	computeSampleTimestamps,
} from "../sample-frames";

describe("computeSampleTimestamps", () => {
	test("returns evenly spaced midpoints at the requested fps", () => {
		const result = computeSampleTimestamps({ durationSec: 1, fps: 4 });
		expect(result).toEqual([0.125, 0.375, 0.625, 0.875]);
	});

	test("produces fps * duration samples for whole-second durations", () => {
		const result = computeSampleTimestamps({ durationSec: 10, fps: 6 });
		expect(result.length).toBe(60);
	});

	test("returns empty array for zero or negative duration", () => {
		expect(computeSampleTimestamps({ durationSec: 0, fps: 6 })).toEqual([]);
		expect(computeSampleTimestamps({ durationSec: -1, fps: 6 })).toEqual([]);
	});

	test("returns empty array for zero or negative fps", () => {
		expect(computeSampleTimestamps({ durationSec: 5, fps: 0 })).toEqual([]);
		expect(computeSampleTimestamps({ durationSec: 5, fps: -2 })).toEqual([]);
	});
});

describe("computeRoiRect", () => {
	test("computes the bottom 35% region by default", () => {
		const roi = computeRoiRect({
			width: 1080,
			height: 1920,
			topRatio: 0.65,
			heightRatio: 0.35,
		});
		expect(roi).toEqual({ x: 0, y: 1248, width: 1080, height: 672 });
	});

	test("clamps height so ROI never overshoots the frame", () => {
		const roi = computeRoiRect({
			width: 100,
			height: 100,
			topRatio: 0.9,
			heightRatio: 0.5,
		});
		expect(roi.y).toBe(90);
		expect(roi.height).toBe(10);
	});
});

describe("computeDownscaledRoiSize", () => {
	test("returns identity when roi width <= maxWidth", () => {
		const out = computeDownscaledRoiSize({
			roiWidth: 480,
			roiHeight: 200,
			maxWidth: 720,
		});
		expect(out).toEqual({ width: 480, height: 200, scale: 1 });
	});

	test("downscales proportionally when wider than maxWidth", () => {
		const out = computeDownscaledRoiSize({
			roiWidth: 1440,
			roiHeight: 600,
			maxWidth: 720,
		});
		expect(out.width).toBe(720);
		expect(out.height).toBe(300);
		expect(out.scale).toBeCloseTo(0.5, 5);
	});
});
