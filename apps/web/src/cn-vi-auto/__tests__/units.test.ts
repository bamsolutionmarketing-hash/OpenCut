import { describe, expect, test } from "bun:test";
import {
	bboxCenterToCanvasPosition,
	bboxToGraphicScale,
	fontSizeForBBoxHeight,
	GRAPHIC_SOURCE_SIZE,
} from "../units";

const CANVAS = { width: 1080, height: 1920 };

describe("bboxCenterToCanvasPosition", () => {
	test("returns (0,0) when bbox center is at canvas center", () => {
		const pos = bboxCenterToCanvasPosition({
			bbox: { x: 480, y: 880, width: 120, height: 160 },
			canvas: CANVAS,
		});
		expect(pos.x).toBe(0);
		expect(pos.y).toBe(0);
	});

	test("returns positive offsets when bbox is right/below center", () => {
		const pos = bboxCenterToCanvasPosition({
			bbox: { x: 600, y: 1000, width: 100, height: 100 },
			canvas: CANVAS,
		});
		expect(pos.x).toBe(110);
		expect(pos.y).toBe(90);
	});

	test("returns negative offsets when bbox is left/above center", () => {
		const pos = bboxCenterToCanvasPosition({
			bbox: { x: 100, y: 100, width: 100, height: 100 },
			canvas: CANVAS,
		});
		expect(pos.x).toBe(-390);
		expect(pos.y).toBe(-810);
	});
});

describe("bboxToGraphicScale", () => {
	test("returns 1 for a bbox the same size as the source", () => {
		const s = bboxToGraphicScale({
			bbox: {
				x: 0,
				y: 0,
				width: GRAPHIC_SOURCE_SIZE,
				height: GRAPHIC_SOURCE_SIZE,
			},
		});
		expect(s.scaleX).toBe(1);
		expect(s.scaleY).toBe(1);
	});

	test("returns w/SOURCE and h/SOURCE for arbitrary bbox", () => {
		const s = bboxToGraphicScale({
			bbox: { x: 0, y: 0, width: 1024, height: 256 },
		});
		expect(s.scaleX).toBe(2);
		expect(s.scaleY).toBe(0.5);
	});
});

describe("fontSizeForBBoxHeight", () => {
	test("scales linearly with bbox height", () => {
		const small = fontSizeForBBoxHeight({
			bboxHeight: 60,
			canvasHeight: 1920,
		});
		const big = fontSizeForBBoxHeight({
			bboxHeight: 120,
			canvasHeight: 1920,
		});
		expect(big).toBeCloseTo(small * 2, 5);
	});

	test("guards against zero canvas height", () => {
		expect(
			fontSizeForBBoxHeight({ bboxHeight: 60, canvasHeight: 0 }),
		).toBe(1);
	});

	test("guards against zero bbox height", () => {
		expect(
			fontSizeForBBoxHeight({ bboxHeight: 0, canvasHeight: 1920 }),
		).toBe(1);
	});
});
