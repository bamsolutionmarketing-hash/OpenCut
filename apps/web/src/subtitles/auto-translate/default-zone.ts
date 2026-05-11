import { DEFAULT_ZONE } from "./defaults";
import type { BBox } from "./types";

export function computeDefaultZone({
	canvas,
}: {
	canvas: { width: number; height: number };
}): BBox {
	return {
		x: canvas.width * DEFAULT_ZONE.xRatio,
		y: canvas.height * DEFAULT_ZONE.yRatio,
		width: canvas.width * DEFAULT_ZONE.widthRatio,
		height: canvas.height * DEFAULT_ZONE.heightRatio,
	};
}
