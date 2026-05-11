import {
	ALL_FORMATS,
	BlobSource,
	Input,
	VideoSampleSink,
} from "mediabunny";
import {
	FRAME_SAMPLING_FPS,
	SUBTITLE_ROI_HEIGHT_RATIO,
	SUBTITLE_ROI_TOP_RATIO,
} from "./defaults";

export interface SampledFrame {
	timeSec: number;
	imageData: ImageData;
	roiOffset: { x: number; y: number };
	originalSize: { width: number; height: number };
}

export interface VideoMetadata {
	durationSec: number;
	width: number;
	height: number;
	fps: number;
}

export interface SampleFramesOptions {
	file: File;
	fps?: number;
	roiTopRatio?: number;
	roiHeightRatio?: number;
	maxRoiWidth?: number;
	signal?: AbortSignal;
	onProgress?: (event: { current: number; total: number }) => void;
}

export async function getVideoMetadata({
	file,
}: {
	file: File;
}): Promise<VideoMetadata> {
	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});
	try {
		const videoTrack = await input.getPrimaryVideoTrack();
		if (!videoTrack) {
			throw new Error("No video track found");
		}
		const durationSec = await input.computeDuration();
		const stats = await videoTrack.computePacketStats(100);
		return {
			durationSec,
			width: videoTrack.displayWidth,
			height: videoTrack.displayHeight,
			fps: stats.averagePacketRate,
		};
	} finally {
		input.dispose();
	}
}

export function computeSampleTimestamps({
	durationSec,
	fps,
}: {
	durationSec: number;
	fps: number;
}): number[] {
	if (durationSec <= 0 || fps <= 0) return [];
	const interval = 1 / fps;
	const count = Math.floor(durationSec * fps);
	const timestamps: number[] = [];
	for (let i = 0; i < count; i++) {
		timestamps.push(i * interval + interval / 2);
	}
	return timestamps;
}

export function computeRoiRect({
	width,
	height,
	topRatio,
	heightRatio,
}: {
	width: number;
	height: number;
	topRatio: number;
	heightRatio: number;
}): { x: number; y: number; width: number; height: number } {
	const y = Math.round(height * topRatio);
	const h = Math.round(height * heightRatio);
	const clampedH = Math.min(h, height - y);
	return { x: 0, y, width, height: clampedH };
}

export function computeDownscaledRoiSize({
	roiWidth,
	roiHeight,
	maxWidth,
}: {
	roiWidth: number;
	roiHeight: number;
	maxWidth: number;
}): { width: number; height: number; scale: number } {
	if (roiWidth <= maxWidth) {
		return { width: roiWidth, height: roiHeight, scale: 1 };
	}
	const scale = maxWidth / roiWidth;
	return {
		width: maxWidth,
		height: Math.round(roiHeight * scale),
		scale,
	};
}

function createOffscreenCanvas({
	width,
	height,
}: {
	width: number;
	height: number;
}): {
	canvas: OffscreenCanvas | HTMLCanvasElement;
	ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} {
	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext("2d", {
			willReadFrequently: true,
		}) as OffscreenCanvasRenderingContext2D | null;
		if (!ctx) throw new Error("Failed to get OffscreenCanvas 2D context");
		return { canvas, ctx };
	}
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("Failed to get canvas 2D context");
	return { canvas, ctx };
}

export async function* sampleFrames({
	file,
	fps = FRAME_SAMPLING_FPS,
	roiTopRatio = SUBTITLE_ROI_TOP_RATIO,
	roiHeightRatio = SUBTITLE_ROI_HEIGHT_RATIO,
	maxRoiWidth = 720,
	signal,
	onProgress,
}: SampleFramesOptions): AsyncGenerator<SampledFrame, void, unknown> {
	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});

	try {
		const videoTrack = await input.getPrimaryVideoTrack();
		if (!videoTrack) {
			throw new Error("No video track found in file");
		}
		if (!(await videoTrack.canDecode())) {
			throw new Error("Video codec cannot be decoded in this browser");
		}

		const width = videoTrack.displayWidth;
		const height = videoTrack.displayHeight;
		const durationSec = await input.computeDuration();
		const timestamps = computeSampleTimestamps({ durationSec, fps });

		const roi = computeRoiRect({
			width,
			height,
			topRatio: roiTopRatio,
			heightRatio: roiHeightRatio,
		});
		const target = computeDownscaledRoiSize({
			roiWidth: roi.width,
			roiHeight: roi.height,
			maxWidth: maxRoiWidth,
		});

		const { ctx } = createOffscreenCanvas({
			width: target.width,
			height: target.height,
		});

		const sink = new VideoSampleSink(videoTrack);
		let processed = 0;

		for await (const sample of sink.samplesAtTimestamps(timestamps)) {
			if (signal?.aborted) {
				sample?.close();
				throw new Error("aborted");
			}

			processed++;
			onProgress?.({ current: processed, total: timestamps.length });

			if (!sample) continue;

			try {
				ctx.clearRect(0, 0, target.width, target.height);
				sample.draw(
					ctx,
					roi.x,
					roi.y,
					roi.width,
					roi.height,
					0,
					0,
					target.width,
					target.height,
				);
				const imageData = ctx.getImageData(0, 0, target.width, target.height);
				yield {
					timeSec: sample.timestamp,
					imageData,
					roiOffset: { x: roi.x, y: roi.y },
					originalSize: { width, height },
				};
			} finally {
				sample.close();
			}
		}
	} finally {
		input.dispose();
	}
}

export async function collectSampledFrames(
	options: SampleFramesOptions,
): Promise<SampledFrame[]> {
	const out: SampledFrame[] = [];
	for await (const frame of sampleFrames(options)) {
		out.push(frame);
	}
	return out;
}
