import { DEFAULTS } from "@/timeline/defaults";
import { mediaTimeFromSeconds } from "@/wasm";
import type { CreateTextElement } from "@/timeline";
import {
	bboxCenterToCanvasPosition,
	fontSizeForBBoxHeight,
} from "./units";
import type { CaptionStyleOptions, MatchedCue } from "./types";

/**
 * Build a TextElement positioned at the matched bbox (from OCR or default zone).
 * The caption text is the user-supplied Vietnamese cue text — we do NOT re-translate.
 *
 * Font size is derived from bbox.height so the caption visually matches the
 * original Chinese line height. Pixel-precise wrap measurement is deferred
 * to the renderer; for our purposes the bbox-centered position is sufficient.
 */
export function buildCaptionElement({
	index,
	cue,
	style,
	canvas,
}: {
	index: number;
	cue: MatchedCue;
	style: CaptionStyleOptions;
	canvas: { width: number; height: number };
}): CreateTextElement {
	const fontSize = fontSizeForBBoxHeight({
		bboxHeight: cue.bbox.height,
		canvasHeight: canvas.height,
		lineHeight: DEFAULTS.text.lineHeight,
	});
	const position = bboxCenterToCanvasPosition({ bbox: cue.bbox, canvas });

	return {
		...DEFAULTS.text.element,
		name: `Caption ${index + 1}`,
		duration: mediaTimeFromSeconds({ seconds: cue.duration }),
		startTime: mediaTimeFromSeconds({ seconds: cue.startTime }),
		params: {
			...DEFAULTS.text.element.params,
			content: cue.text,
			fontSize,
			fontFamily: style.fontFamily,
			color: style.color,
			textAlign: "center",
			fontWeight: "bold",
			"transform.positionX": position.x,
			"transform.positionY": position.y,
		},
	};
}

export function buildAllCaptionElements({
	cues,
	style,
	canvas,
}: {
	cues: MatchedCue[];
	style: CaptionStyleOptions;
	canvas: { width: number; height: number };
}): CreateTextElement[] {
	return cues.map((cue, index) =>
		buildCaptionElement({ index, cue, style, canvas }),
	);
}
