import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/wasm";
import {
	buildDefaultParamValues,
	getBuiltInElementParams,
} from "@/params/registry";
import type { CreateVideoElement } from "@/timeline";
import { paramsFromSegment } from "./segment-variation";
import type { SegmentInstance } from "./types";

/**
 * Build a CreateVideoElement per segment, splitting one source video into
 * trimmed clips with random transform params.
 *
 * Source range [startSec, endSec] is encoded via trimStart + trimEnd
 * relative to `sourceDurationSec`. Speed is applied via `retime.rate`.
 * Timeline duration = sourceLength / speed.
 *
 * Timeline placement is sequential — each segment starts when the previous
 * one ends.
 */
export function buildSegmentVideoElements({
	mediaId,
	segments,
	sourceDurationSec,
	canvas,
}: {
	mediaId: string;
	segments: SegmentInstance[];
	sourceDurationSec: number;
	canvas: { width: number; height: number };
}): CreateVideoElement[] {
	const out: CreateVideoElement[] = [];
	let timelineCursor = 0;
	for (const segment of segments) {
		const sourceLen = segment.endSec - segment.startSec;
		const timelineLen = sourceLen / Math.max(0.01, segment.speed);
		const trimStart = mediaTimeFromSeconds({ seconds: segment.startSec });
		const trimEndSec = Math.max(0, sourceDurationSec - segment.endSec);
		const trimEnd = mediaTimeFromSeconds({ seconds: trimEndSec });

		out.push({
			type: "video",
			mediaId,
			name: `Segment ${segment.index + 1}`,
			duration: mediaTimeFromSeconds({ seconds: timelineLen }),
			startTime: mediaTimeFromSeconds({ seconds: timelineCursor }),
			trimStart,
			trimEnd,
			sourceDuration: mediaTimeFromSeconds({ seconds: sourceDurationSec }),
			isSourceAudioEnabled: false,
			retime:
				segment.speed !== 1
					? { rate: segment.speed, maintainPitch: true }
					: undefined,
			params: {
				...buildDefaultParamValues(getBuiltInElementParams({ type: "video" })),
				...paramsFromSegment({ segment, canvas }),
			},
		} satisfies CreateVideoElement);

		timelineCursor += timelineLen;
	}
	return out;
}

/**
 * Sum of segment timeline lengths — useful for orchestrator to know the new
 * total video length after speed adjustments.
 */
export function totalTimelineDuration({
	segments,
}: {
	segments: SegmentInstance[];
}): number {
	let total = 0;
	for (const seg of segments) {
		total += (seg.endSec - seg.startSec) / Math.max(0.01, seg.speed);
	}
	return total;
}
