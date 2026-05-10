import type { BBox } from "./types";

export type ZoneId =
	| "top-left"
	| "top-center"
	| "top-right"
	| "middle-left"
	| "middle-center"
	| "middle-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export const ALL_ZONES: ZoneId[] = [
	"top-left",
	"top-center",
	"top-right",
	"middle-left",
	"middle-center",
	"middle-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

interface ZoneAxisRatios {
	row: 0 | 1 | 2; // 0=top, 1=middle, 2=bottom
	col: 0 | 1 | 2; // 0=left, 1=center, 2=right
}

const ZONE_AXIS: Record<ZoneId, ZoneAxisRatios> = {
	"top-left": { row: 0, col: 0 },
	"top-center": { row: 0, col: 1 },
	"top-right": { row: 0, col: 2 },
	"middle-left": { row: 1, col: 0 },
	"middle-center": { row: 1, col: 1 },
	"middle-right": { row: 1, col: 2 },
	"bottom-left": { row: 2, col: 0 },
	"bottom-center": { row: 2, col: 1 },
	"bottom-right": { row: 2, col: 2 },
};

/**
 * Compute the pixel-space bbox where the logo should be drawn for a given zone.
 * The logo is sized as a square: `min(canvas.width, canvas.height) * sizeRatio`.
 * `paddingRatio` insets the logo from the canvas edge.
 */
export function getZoneRect({
	zone,
	canvas,
	sizeRatio,
	paddingRatio,
}: {
	zone: ZoneId;
	canvas: { width: number; height: number };
	sizeRatio: number;
	paddingRatio: number;
}): BBox {
	const axis = ZONE_AXIS[zone];
	const minDim = Math.min(canvas.width, canvas.height);
	const size = minDim * sizeRatio;
	const padX = canvas.width * paddingRatio;
	const padY = canvas.height * paddingRatio;

	let x: number;
	if (axis.col === 0) x = padX;
	else if (axis.col === 1) x = (canvas.width - size) / 2;
	else x = canvas.width - size - padX;

	let y: number;
	if (axis.row === 0) y = padY;
	else if (axis.row === 1) y = (canvas.height - size) / 2;
	else y = canvas.height - size - padY;

	return { x, y, width: size, height: size };
}

/** True when two axis-aligned bboxes overlap (touching edges count as no-overlap). */
export function bboxesOverlap({ a, b }: { a: BBox; b: BBox }): boolean {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}

/** True when the candidate zone rect overlaps any of the given caption bboxes. */
export function zoneOverlapsCaption({
	zoneRect,
	captionBBoxes,
}: {
	zoneRect: BBox;
	captionBBoxes: BBox[];
}): boolean {
	for (const bbox of captionBBoxes) {
		if (bboxesOverlap({ a: zoneRect, b: bbox })) return true;
	}
	return false;
}
