import type { SeededRng } from "./random-utils";
import type {
	MatchedCue,
	SegmentInstance,
	SegmentTransformOptions,
} from "./types";

const MIN_SEGMENT_DURATION = 0.5;
const CUE_SNAP_TOLERANCE_SEC = 0.5;

/**
 * Split [0, totalDurationSec] into segments of `segmentDurationSec` each.
 * Segment boundaries snap forward to the nearest cue end if a cue would be
 * mid-cut within `CUE_SNAP_TOLERANCE_SEC`. Last segment may be shorter.
 */
export function computeSegmentBoundaries({
	totalDurationSec,
	segmentDurationSec,
	cues,
}: {
	totalDurationSec: number;
	segmentDurationSec: number;
	cues: MatchedCue[];
}): { startSec: number; endSec: number; containsCue: boolean }[] {
	if (totalDurationSec <= 0 || segmentDurationSec <= 0) return [];
	const out: { startSec: number; endSec: number; containsCue: boolean }[] = [];
	let t = 0;
	while (t < totalDurationSec) {
		let target = Math.min(totalDurationSec, t + segmentDurationSec);
		// Snap forward if target lands inside a cue.
		const splittingCue = cues.find(
			(c) =>
				target > c.startTime + CUE_SNAP_TOLERANCE_SEC &&
				target < c.startTime + c.duration - CUE_SNAP_TOLERANCE_SEC,
		);
		if (splittingCue) {
			target = Math.min(
				totalDurationSec,
				splittingCue.startTime + splittingCue.duration,
			);
		}
		if (target - t < MIN_SEGMENT_DURATION && target < totalDurationSec) {
			target = Math.min(totalDurationSec, target + MIN_SEGMENT_DURATION);
		}
		const containsCue = cues.some(
			(c) =>
				c.startTime + c.duration > t && c.startTime < target,
		);
		out.push({ startSec: t, endSec: target, containsCue });
		t = target;
	}
	return out;
}

/**
 * Pick random transform values for a segment based on options.
 * Flip is suppressed when the segment contains a cue (text would be mirrored).
 */
export function pickTransformsForSegment({
	index,
	startSec,
	endSec,
	containsCue,
	options,
	rng,
}: {
	index: number;
	startSec: number;
	endSec: number;
	containsCue: boolean;
	options: SegmentTransformOptions;
	rng: SeededRng;
}): SegmentInstance {
	const scale = options.scale.enabled
		? rng.float(options.scale.min, options.scale.max)
		: 1;
	const flip =
		options.flip.enabled && !containsCue && rng.bool(options.flip.probability);
	const rotateDeg = options.rotate.enabled
		? rng.float(options.rotate.minDeg, options.rotate.maxDeg)
		: 0;
	const cropOffsetX = options.cropX.enabled
		? rng.float(-options.cropX.range, options.cropX.range)
		: 0;
	const cropOffsetY = options.cropY.enabled
		? rng.float(-options.cropY.range, options.cropY.range)
		: 0;
	const speed = options.speed.enabled
		? rng.float(options.speed.min, options.speed.max)
		: 1;
	const zoomMode = options.zoom.enabled
		? rng.pick(options.zoom.modes)
		: "static";

	return {
		index,
		startSec,
		endSec,
		flip,
		rotateDeg,
		scale,
		zoomMode,
		cropOffsetX,
		cropOffsetY,
		speed,
		containsCue,
	};
}

/**
 * Convert a SegmentInstance to OpenCut transform ParamValues.
 * Flip = negative scaleX. Crop offsets shift the element by a fraction of canvas.
 */
export function paramsFromSegment({
	segment,
	canvas,
}: {
	segment: SegmentInstance;
	canvas: { width: number; height: number };
}): Record<string, number> {
	const baseScale = segment.scale;
	const scaleX = (segment.flip ? -1 : 1) * baseScale;
	const scaleY = baseScale;
	const positionX = canvas.width * segment.cropOffsetX;
	const positionY = canvas.height * segment.cropOffsetY;
	return {
		"transform.positionX": positionX,
		"transform.positionY": positionY,
		"transform.scaleX": scaleX,
		"transform.scaleY": scaleY,
		"transform.rotate": segment.rotateDeg,
	};
}

export function buildSegmentInstances({
	cues,
	options,
	totalDurationSec,
	rng,
}: {
	cues: MatchedCue[];
	options: SegmentTransformOptions;
	totalDurationSec: number;
	rng: SeededRng;
}): SegmentInstance[] {
	const boundaries = computeSegmentBoundaries({
		totalDurationSec,
		segmentDurationSec: options.durationSec,
		cues,
	});
	return boundaries.map((b, i) =>
		pickTransformsForSegment({
			index: i,
			startSec: b.startSec,
			endSec: b.endSec,
			containsCue: b.containsCue,
			options,
			rng: rng.fork(i + 1),
		}),
	);
}
