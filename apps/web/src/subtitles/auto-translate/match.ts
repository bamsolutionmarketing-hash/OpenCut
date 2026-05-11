import { computeDefaultZone } from "./default-zone";
import type { SubtitleCue } from "@/subtitles/types";
import type { BBox, MatchedCue, OcrBox, OcrFrame } from "./types";

export interface MatchOptions {
	canvas: { width: number; height: number };
	paddingRatio?: number;
	mergeVerticalGapRatio?: number;
	nearestNeighborWindowSec?: number;
}

const DEFAULT_PADDING_RATIO = 0.12;
const DEFAULT_MERGE_GAP_RATIO = 0.5;
const DEFAULT_NN_WINDOW_SEC = 2;

export function framesInTimeRange({
	frames,
	startSec,
	endSec,
}: {
	frames: OcrFrame[];
	startSec: number;
	endSec: number;
}): OcrFrame[] {
	const out: OcrFrame[] = [];
	for (const frame of frames) {
		if (frame.timeSec >= startSec && frame.timeSec <= endSec) {
			out.push(frame);
		}
	}
	return out;
}

export function mergeBoxesPerFrame({
	boxes,
	mergeVerticalGapRatio,
}: {
	boxes: OcrBox[];
	mergeVerticalGapRatio: number;
}): BBox[] {
	if (boxes.length === 0) return [];
	const sorted = [...boxes].sort((a, b) => a.bbox.y - b.bbox.y);
	const groups: BBox[] = [];
	let current: BBox = { ...sorted[0]!.bbox };
	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i]!.bbox;
		const gap = next.y - (current.y + current.height);
		const referenceHeight = Math.max(current.height, next.height);
		if (gap <= referenceHeight * mergeVerticalGapRatio) {
			const x1 = Math.min(current.x, next.x);
			const y1 = Math.min(current.y, next.y);
			const x2 = Math.max(current.x + current.width, next.x + next.width);
			const y2 = Math.max(current.y + current.height, next.y + next.height);
			current = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
		} else {
			groups.push(current);
			current = { ...next };
		}
	}
	groups.push(current);
	return groups;
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[mid - 1]! + sorted[mid]!) / 2;
	}
	return sorted[mid]!;
}

export function medianBBox({ bboxes }: { bboxes: BBox[] }): BBox | null {
	if (bboxes.length === 0) return null;
	return {
		x: median(bboxes.map((b) => b.x)),
		y: median(bboxes.map((b) => b.y)),
		width: median(bboxes.map((b) => b.width)),
		height: median(bboxes.map((b) => b.height)),
	};
}

export function padBBox({
	bbox,
	paddingRatio,
	canvas,
}: {
	bbox: BBox;
	paddingRatio: number;
	canvas: { width: number; height: number };
}): BBox {
	const padX = bbox.width * paddingRatio;
	const padY = bbox.height * paddingRatio;
	const x = Math.max(0, bbox.x - padX);
	const y = Math.max(0, bbox.y - padY);
	const right = Math.min(canvas.width, bbox.x + bbox.width + padX);
	const bottom = Math.min(canvas.height, bbox.y + bbox.height + padY);
	return {
		x,
		y,
		width: Math.max(0, right - x),
		height: Math.max(0, bottom - y),
	};
}

export function matchCueToBBox({
	cue,
	ocrFrames,
	options,
}: {
	cue: SubtitleCue;
	ocrFrames: OcrFrame[];
	options: Required<MatchOptions>;
}): { bbox: BBox; source: MatchedCue["bboxSource"] } {
	const inRange = framesInTimeRange({
		frames: ocrFrames,
		startSec: cue.startTime,
		endSec: cue.startTime + cue.duration,
	});

	const merged: BBox[] = [];
	for (const frame of inRange) {
		const groups = mergeBoxesPerFrame({
			boxes: frame.boxes,
			mergeVerticalGapRatio: options.mergeVerticalGapRatio,
		});
		if (groups.length > 0) {
			merged.push(groups[0]!);
		}
	}

	const directMedian = medianBBox({ bboxes: merged });
	if (directMedian) {
		return {
			bbox: padBBox({
				bbox: directMedian,
				paddingRatio: options.paddingRatio,
				canvas: options.canvas,
			}),
			source: "ocr",
		};
	}

	return {
		bbox: computeDefaultZone({ canvas: options.canvas }),
		source: "default-zone",
	};
}

export function matchAllCues({
	cues,
	ocrFrames,
	options,
}: {
	cues: SubtitleCue[];
	ocrFrames: OcrFrame[];
	options: MatchOptions;
}): MatchedCue[] {
	const fullOptions: Required<MatchOptions> = {
		canvas: options.canvas,
		paddingRatio: options.paddingRatio ?? DEFAULT_PADDING_RATIO,
		mergeVerticalGapRatio:
			options.mergeVerticalGapRatio ?? DEFAULT_MERGE_GAP_RATIO,
		nearestNeighborWindowSec:
			options.nearestNeighborWindowSec ?? DEFAULT_NN_WINDOW_SEC,
	};

	const initial = cues.map((cue) => {
		const result = matchCueToBBox({
			cue,
			ocrFrames,
			options: fullOptions,
		});
		return { cue, bbox: result.bbox, source: result.source };
	});

	return initial.map(({ cue, bbox, source }, index) => {
		if (source !== "default-zone") {
			return { ...cue, bbox, bboxSource: source };
		}
		const neighbor = findNearestOcrNeighbor({
			items: initial,
			index,
			windowSec: fullOptions.nearestNeighborWindowSec,
		});
		if (neighbor) {
			return {
				...cue,
				bbox: padBBox({
					bbox: neighbor,
					paddingRatio: fullOptions.paddingRatio,
					canvas: fullOptions.canvas,
				}),
				bboxSource: "nearest-neighbor",
			};
		}
		return { ...cue, bbox, bboxSource: source };
	});
}

function findNearestOcrNeighbor({
	items,
	index,
	windowSec,
}: {
	items: { cue: SubtitleCue; bbox: BBox; source: MatchedCue["bboxSource"] }[];
	index: number;
	windowSec: number;
}): BBox | null {
	const target = items[index]!.cue;
	const targetMid = target.startTime + target.duration / 2;
	let best: { bbox: BBox; dist: number } | null = null;
	for (let i = 0; i < items.length; i++) {
		if (i === index) continue;
		const item = items[i]!;
		if (item.source !== "ocr") continue;
		const itemMid = item.cue.startTime + item.cue.duration / 2;
		const dist = Math.abs(itemMid - targetMid);
		if (dist > windowSec) continue;
		if (!best || dist < best.dist) best = { bbox: item.bbox, dist };
	}
	return best?.bbox ?? null;
}
