import type { BBox } from "./types";

/** Source size used by OpenCut graphic definitions (mirrors DEFAULT_GRAPHIC_SOURCE_SIZE = 512). */
export const GRAPHIC_SOURCE_SIZE = 512;

/** OpenCut maps user-space `fontSize` to pixels via `fontSize * canvasHeight / FONT_SIZE_SCALE_REFERENCE`. */
export const FONT_SIZE_SCALE_REFERENCE = 90;

/**
 * OpenCut transform.position uses canvas-centered coords: 0 = center.
 * Convert a top-left pixel-space bbox to the center-offset of its center point.
 */
export function bboxCenterToCanvasPosition({
	bbox,
	canvas,
}: {
	bbox: BBox;
	canvas: { width: number; height: number };
}): { x: number; y: number } {
	const cx = bbox.x + bbox.width / 2;
	const cy = bbox.y + bbox.height / 2;
	return {
		x: cx - canvas.width / 2,
		y: cy - canvas.height / 2,
	};
}

/**
 * Compute scaleX/scaleY for a unit-source-size graphic to fill `bbox`.
 * (OpenCut graphics render into a 512x512 source, then transform.scale resizes them.)
 */
export function bboxToGraphicScale({ bbox }: { bbox: BBox }): {
	scaleX: number;
	scaleY: number;
} {
	return {
		scaleX: bbox.width / GRAPHIC_SOURCE_SIZE,
		scaleY: bbox.height / GRAPHIC_SOURCE_SIZE,
	};
}

/**
 * Pick a fontSize (user-space) so its rendered line height roughly matches `bboxHeight`.
 * Reverses OpenCut's scaling: renderedPx = fontSize * canvasHeight / FONT_SIZE_SCALE_REFERENCE
 * Then divides by lineHeight to get a single-line ascent target.
 */
export function fontSizeForBBoxHeight({
	bboxHeight,
	canvasHeight,
	lineHeight = 1.2,
}: {
	bboxHeight: number;
	canvasHeight: number;
	lineHeight?: number;
}): number {
	if (canvasHeight <= 0 || bboxHeight <= 0) return 1;
	const renderedTargetPx = bboxHeight / lineHeight;
	return (renderedTargetPx * FONT_SIZE_SCALE_REFERENCE) / canvasHeight;
}
