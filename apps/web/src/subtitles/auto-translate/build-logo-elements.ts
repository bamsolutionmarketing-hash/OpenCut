import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/wasm";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/params/registry";
import type { CreateImageElement } from "@/timeline";
import { getZoneRect } from "./zones";
import { bboxCenterToCanvasPosition, bboxToGraphicScale } from "./units";
import type { LogoSlot } from "./logo-placement";
import type { LogoPlacementOptions } from "./types";

/**
 * Build CreateImageElements for each logo slot, positioned at the zone center.
 * Caller registers the logo File via AddMediaAssetCommand to get `mediaId`.
 */
export function buildLogoElements({
	mediaId,
	slots,
	options,
	canvas,
}: {
	mediaId: string;
	slots: LogoSlot[];
	options: LogoPlacementOptions;
	canvas: { width: number; height: number };
}): CreateImageElement[] {
	return slots.map((slot, index) => {
		const rect = getZoneRect({
			zone: slot.zone,
			canvas,
			sizeRatio: options.sizeRatio,
			paddingRatio: options.paddingRatio,
		});
		const position = bboxCenterToCanvasPosition({ bbox: rect, canvas });
		const { scaleX, scaleY } = bboxToGraphicScale({ bbox: rect });

		return {
			type: "image",
			mediaId,
			name: `Logo ${index + 1}`,
			duration: mediaTimeFromSeconds({ seconds: slot.endSec - slot.startSec }),
			startTime: mediaTimeFromSeconds({ seconds: slot.startSec }),
			trimStart: ZERO_MEDIA_TIME,
			trimEnd: ZERO_MEDIA_TIME,
			hidden: false,
			params: {
				...buildDefaultParamValues(getBuiltInElementParams({ type: "image" })),
				opacity: options.opacity,
				"transform.positionX": position.x,
				"transform.positionY": position.y,
				"transform.scaleX": scaleX,
				"transform.scaleY": scaleY,
			},
		};
	});
}
