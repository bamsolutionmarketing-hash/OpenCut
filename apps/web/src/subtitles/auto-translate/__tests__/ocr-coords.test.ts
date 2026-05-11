import { describe, expect, test } from "bun:test";
import { pageToOcrBoxes, tesseractBboxToBBox } from "../ocr";
import type { SampledFrame } from "../sample-frames";

describe("tesseractBboxToBBox", () => {
	test("converts coords back to original-frame pixel space when scale=1", () => {
		const bbox = tesseractBboxToBBox({
			bbox: { x0: 100, y0: 200, x1: 400, y1: 280 },
			scale: 1,
			roiOffset: { x: 0, y: 1248 },
		});
		expect(bbox).toEqual({ x: 100, y: 1448, width: 300, height: 80 });
	});

	test("scales coords back when frame was downscaled before OCR", () => {
		const bbox = tesseractBboxToBBox({
			bbox: { x0: 50, y0: 100, x1: 200, y1: 140 },
			scale: 0.5,
			roiOffset: { x: 0, y: 1248 },
		});
		expect(bbox).toEqual({ x: 100, y: 1448, width: 300, height: 80 });
	});
});

function makeFrame(): SampledFrame {
	return {
		timeSec: 1.0,
		imageData: { width: 720, height: 224 } as ImageData,
		roiOffset: { x: 0, y: 1248 },
		originalSize: { width: 1080, height: 1920 },
	};
}

describe("pageToOcrBoxes", () => {
	test("flattens blocks → paragraphs → lines and filters by confidence", () => {
		const page = {
			blocks: [
				{
					text: "ignored",
					confidence: 80,
					bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
					paragraphs: [
						{
							lines: [
								{
									text: "你好世界",
									confidence: 80,
									bbox: { x0: 100, y0: 50, x1: 400, y1: 90 },
								},
								{
									text: "low conf",
									confidence: 30,
									bbox: { x0: 0, y0: 0, x1: 100, y1: 20 },
								},
								{
									text: "  ",
									confidence: 90,
									bbox: { x0: 0, y0: 0, x1: 50, y1: 10 },
								},
							],
						},
					],
				},
			],
		};

		const boxes = pageToOcrBoxes({
			page,
			frame: makeFrame(),
			minConfidence: 50,
		});

		expect(boxes.length).toBe(1);
		expect(boxes[0]?.text).toBe("你好世界");
		expect(boxes[0]?.confidence).toBe(80);
		expect(boxes[0]?.polygon).toHaveLength(4);
	});

	test("returns empty array when page has no blocks", () => {
		const boxes = pageToOcrBoxes({
			page: { blocks: null },
			frame: makeFrame(),
			minConfidence: 50,
		});
		expect(boxes).toEqual([]);
	});
});
