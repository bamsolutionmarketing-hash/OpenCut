import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import { OCR_LANGUAGES, OCR_MIN_CONFIDENCE } from "./defaults";
import type { BBox, OcrBox, OcrFrame } from "./types";
import type { SampledFrame } from "./sample-frames";

export interface OcrSession {
	recognize: (frame: SampledFrame) => Promise<OcrFrame>;
	dispose: () => Promise<void>;
}

export interface OcrSessionOptions {
	langs?: string;
	minConfidence?: number;
	onLoad?: (event: { progress: number; status: string }) => void;
}

interface TesseractBbox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

interface TesseractWordLike {
	text: string;
	confidence: number;
	bbox: TesseractBbox;
}

interface TesseractLineLike {
	text: string;
	confidence: number;
	bbox: TesseractBbox;
	words?: TesseractWordLike[];
}

interface TesseractBlockLike {
	text: string;
	confidence: number;
	bbox: TesseractBbox;
	paragraphs?: { lines?: TesseractLineLike[] }[];
}

interface TesseractPageLike {
	blocks: TesseractBlockLike[] | null;
}

export function tesseractBboxToBBox({
	bbox,
	scale,
	roiOffset,
}: {
	bbox: TesseractBbox;
	scale: number;
	roiOffset: { x: number; y: number };
}): BBox {
	const x = bbox.x0 / scale + roiOffset.x;
	const y = bbox.y0 / scale + roiOffset.y;
	const width = (bbox.x1 - bbox.x0) / scale;
	const height = (bbox.y1 - bbox.y0) / scale;
	return { x, y, width, height };
}

export function pageToOcrBoxes({
	page,
	frame,
	minConfidence,
}: {
	page: TesseractPageLike;
	frame: SampledFrame;
	minConfidence: number;
}): OcrBox[] {
	const blocks = page.blocks ?? [];
	const scaleX = frame.imageData.width / frame.originalSize.width;
	const scale = scaleX === 0 ? 1 : scaleX;

	const lines: TesseractLineLike[] = [];
	for (const block of blocks) {
		const paragraphs = block.paragraphs ?? [];
		for (const para of paragraphs) {
			for (const line of para.lines ?? []) {
				lines.push(line);
			}
		}
	}

	const out: OcrBox[] = [];
	for (const line of lines) {
		if (line.confidence < minConfidence) continue;
		const text = line.text.trim();
		if (!text) continue;

		const bbox = tesseractBboxToBBox({
			bbox: line.bbox,
			scale,
			roiOffset: frame.roiOffset,
		});

		out.push({
			polygon: [
				{ x: bbox.x, y: bbox.y },
				{ x: bbox.x + bbox.width, y: bbox.y },
				{ x: bbox.x + bbox.width, y: bbox.y + bbox.height },
				{ x: bbox.x, y: bbox.y + bbox.height },
			],
			bbox,
			text,
			confidence: line.confidence,
		});
	}
	return out;
}

function imageDataToCanvas({
	imageData,
}: {
	imageData: ImageData;
}): OffscreenCanvas | HTMLCanvasElement {
	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(imageData.width, imageData.height);
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
		ctx.putImageData(imageData, 0, 0);
		return canvas;
	}
	const canvas = document.createElement("canvas");
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context unavailable");
	ctx.putImageData(imageData, 0, 0);
	return canvas;
}

export async function createOcrSession({
	langs = OCR_LANGUAGES,
	minConfidence = OCR_MIN_CONFIDENCE,
	onLoad,
}: OcrSessionOptions = {}): Promise<OcrSession> {
	const worker: TesseractWorker = await createWorker(langs, undefined, {
		logger: (msg) => {
			onLoad?.({ progress: msg.progress, status: msg.status });
		},
	});

	let disposed = false;

	async function recognize(frame: SampledFrame): Promise<OcrFrame> {
		if (disposed) throw new Error("OcrSession is disposed");
		const canvas = imageDataToCanvas({ imageData: frame.imageData });
		const result = await worker.recognize(canvas as unknown as HTMLCanvasElement);
		const page = result.data as unknown as TesseractPageLike;
		const boxes = pageToOcrBoxes({ page, frame, minConfidence });
		return {
			timeSec: frame.timeSec,
			boxes,
		};
	}

	async function dispose(): Promise<void> {
		if (disposed) return;
		disposed = true;
		await worker.terminate();
	}

	return { recognize, dispose };
}

export async function recognizeFrames({
	frames,
	session,
	onProgress,
	signal,
}: {
	frames: AsyncIterable<SampledFrame> | Iterable<SampledFrame>;
	session: OcrSession;
	onProgress?: (event: { current: number; total: number | null }) => void;
	signal?: AbortSignal;
}): Promise<OcrFrame[]> {
	const out: OcrFrame[] = [];
	let total: number | null = null;
	if (Array.isArray(frames)) total = frames.length;

	let processed = 0;
	for await (const frame of frames as AsyncIterable<SampledFrame>) {
		if (signal?.aborted) throw new Error("aborted");
		const result = await session.recognize(frame);
		out.push(result);
		processed++;
		onProgress?.({ current: processed, total });
	}
	return out;
}
