import {
	ALL_ZONES,
	getZoneRect,
	zoneOverlapsCaption,
	type ZoneId,
} from "./zones";
import type { SeededRng } from "./random-utils";
import type { BBox, LogoPlacementOptions, MatchedCue } from "./types";

const FALLBACK_ZONE: ZoneId = "top-right";

export interface LogoSlot {
	startSec: number;
	endSec: number;
	zone: ZoneId;
}

/** Split [0, totalDuration] into intervals of `intervalSec` each (last may be shorter). */
export function computeLogoSlotTimes({
	totalDurationSec,
	intervalSec,
}: {
	totalDurationSec: number;
	intervalSec: number;
}): { startSec: number; endSec: number }[] {
	if (totalDurationSec <= 0 || intervalSec <= 0) return [];
	const out: { startSec: number; endSec: number }[] = [];
	let t = 0;
	while (t < totalDurationSec) {
		const end = Math.min(totalDurationSec, t + intervalSec);
		out.push({ startSec: t, endSec: end });
		t = end;
	}
	return out;
}

/** Caption bboxes that intersect a slot's time range. */
export function captionBBoxesForSlot({
	slot,
	cues,
}: {
	slot: { startSec: number; endSec: number };
	cues: MatchedCue[];
}): BBox[] {
	const out: BBox[] = [];
	for (const cue of cues) {
		const cueEnd = cue.startTime + cue.duration;
		if (cueEnd <= slot.startSec || cue.startTime >= slot.endSec) continue;
		out.push(cue.bbox);
	}
	return out;
}

/**
 * Pick a zone for a slot:
 *   1. Filter zones to those that don't overlap any caption (when avoidCaption=true)
 *   2. Filter out the previous slot's zone (anti-repeat)
 *   3. Random pick from remaining; on empty fall back to FALLBACK_ZONE
 */
export function pickZoneForSlot({
	slot,
	cues,
	options,
	canvas,
	rng,
	previousZone,
}: {
	slot: { startSec: number; endSec: number };
	cues: MatchedCue[];
	options: LogoPlacementOptions;
	canvas: { width: number; height: number };
	rng: SeededRng;
	previousZone: ZoneId | null;
}): ZoneId {
	const captionBBoxes = options.avoidCaption
		? captionBBoxesForSlot({ slot, cues })
		: [];

	let candidates = ALL_ZONES.filter((zone) => {
		if (!options.avoidCaption) return true;
		const rect = getZoneRect({
			zone,
			canvas,
			sizeRatio: options.sizeRatio,
			paddingRatio: options.paddingRatio,
		});
		return !zoneOverlapsCaption({ zoneRect: rect, captionBBoxes });
	});

	if (previousZone && candidates.length > 1) {
		candidates = candidates.filter((z) => z !== previousZone);
	}

	if (candidates.length === 0) return FALLBACK_ZONE;
	return rng.pick(candidates);
}

export function computeLogoSlots({
	cues,
	options,
	canvas,
	totalDurationSec,
	rng,
}: {
	cues: MatchedCue[];
	options: LogoPlacementOptions;
	canvas: { width: number; height: number };
	totalDurationSec: number;
	rng: SeededRng;
}): LogoSlot[] {
	if (!options.enabled) return [];
	const times = computeLogoSlotTimes({
		totalDurationSec,
		intervalSec: options.intervalSec,
	});

	const slots: LogoSlot[] = [];
	let previousZone: ZoneId | null = null;
	for (const time of times) {
		const zone = pickZoneForSlot({
			slot: time,
			cues,
			options,
			canvas,
			rng,
			previousZone,
		});
		slots.push({ startSec: time.startSec, endSec: time.endSec, zone });
		previousZone = zone;
	}
	return slots;
}
