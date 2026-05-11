import { buildGraphicElement } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";
import type { CreateGraphicElement } from "@/timeline";
import { bboxCenterToCanvasPosition, bboxToGraphicScale } from "./units";
import type { CoverStyleOptions, MatchedCue } from "./types";

const COVER_DEFINITION_ID = "rectangle";

/**
 * Build a rectangle GraphicElement that covers the matched bbox for the cue's slot.
 * Color, opacity, and padding come from CoverStyleOptions.
 */
export function buildCoverElement({
	index,
	cue,
	style,
	canvas,
}: {
	index: number;
	cue: MatchedCue;
	style: CoverStyleOptions;
	canvas: { width: number; height: number };
}): CreateGraphicElement {
	const padX = cue.bbox.width * style.paddingRatio;
	const padY = cue.bbox.height * style.paddingRatio;
	const padded = {
		x: Math.max(0, cue.bbox.x - padX),
		y: Math.max(0, cue.bbox.y - padY),
		width: Math.min(canvas.width, cue.bbox.width + padX * 2),
		height: Math.min(canvas.height, cue.bbox.height + padY * 2),
	};

	const position = bboxCenterToCanvasPosition({ bbox: padded, canvas });
	const { scaleX, scaleY } = bboxToGraphicScale({ bbox: padded });

	const element = buildGraphicElement({
		definitionId: COVER_DEFINITION_ID,
		name: `Cover ${index + 1}`,
		startTime: mediaTimeFromSeconds({ seconds: cue.startTime }),
		params: {
			fill: style.color,
			opacity: style.opacity,
			"transform.positionX": position.x,
			"transform.positionY": position.y,
			"transform.scaleX": scaleX,
			"transform.scaleY": scaleY,
		},
	});

	return {
		...element,
		duration: mediaTimeFromSeconds({ seconds: cue.duration }),
	};
}

export function buildAllCoverElements({
	cues,
	style,
	canvas,
}: {
	cues: MatchedCue[];
	style: CoverStyleOptions;
	canvas: { width: number; height: number };
}): CreateGraphicElement[] {
	return cues.map((cue, index) =>
		buildCoverElement({ index, cue, style, canvas }),
	);
}
