import type { SubtitleCue } from "@/subtitles/types";

export interface BBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface OcrBox {
	polygon: { x: number; y: number }[];
	bbox: BBox;
	text: string;
	confidence: number;
}

export interface OcrFrame {
	timeSec: number;
	boxes: OcrBox[];
}

export interface MatchedCue extends SubtitleCue {
	bbox: BBox;
	bboxSource: "ocr" | "default-zone" | "nearest-neighbor";
}

export interface TtsResult {
	pcm: Float32Array;
	sampleRate: number;
	durationSec: number;
}

export interface FittedTts {
	pcm: Float32Array;
	sampleRate: number;
	durationSec: number;
	speedRatio: number;
}

export type EmotionTag =
	| "happy"
	| "laugh"
	| "sad"
	| "surprise"
	| "suspense"
	| "romantic"
	| "question"
	| "exclaim"
	| "neutral";

export interface ClassifiedCue extends MatchedCue {
	emotions: EmotionTag[];
}

export type SfxCategory = "emotion" | "text" | "transition";

export interface SfxAsset {
	id: string;
	file: string;
	durationSec: number;
	defaultGain: number;
	category: SfxCategory;
	tags: string[];
	source: string;
	license: "CC0" | "Mixkit" | "Pixabay";
}

export interface SfxPick {
	asset: SfxAsset;
	startSec: number;
	gain: number;
}

export type SfxLevel = "off" | "light" | "medium" | "heavy";

export interface SegmentTransformOptions {
	durationSec: number;
	scale: { enabled: boolean; min: number; max: number };
	zoom: {
		enabled: boolean;
		modes: ReadonlyArray<"static" | "slow-in" | "slow-out" | "ken-burns">;
	};
	flip: { enabled: boolean; probability: number };
	rotate: { enabled: boolean; minDeg: number; maxDeg: number };
	cropX: { enabled: boolean; range: number };
	cropY: { enabled: boolean; range: number };
	speed: { enabled: boolean; min: number; max: number };
}

export interface SegmentInstance {
	index: number;
	startSec: number;
	endSec: number;
	flip: boolean;
	rotateDeg: number;
	scale: number;
	zoomMode: "static" | "slow-in" | "slow-out" | "ken-burns";
	cropOffsetX: number;
	cropOffsetY: number;
	speed: number;
	containsCue: boolean;
}

export interface LogoPlacementOptions {
	enabled: boolean;
	intervalSec: number;
	sizeRatio: number;
	opacity: number;
	avoidCaption: boolean;
	paddingRatio: number;
}

export interface LogoSlot {
	startSec: number;
	endSec: number;
	zone:
		| "top-left"
		| "top-center"
		| "top-right"
		| "middle-left"
		| "middle-center"
		| "middle-right"
		| "bottom-left"
		| "bottom-center"
		| "bottom-right";
}

export interface CoverStyleOptions {
	color: string;
	opacity: number;
	paddingRatio: number;
}

export interface CaptionStyleOptions {
	fontFamily: string;
	color: string;
	strokeColor: string;
	strokeWidth: number;
}

export interface TtsOptions {
	enabled: boolean;
	muteOriginal: boolean;
}

export interface SfxOptions {
	enabled: boolean;
	level: SfxLevel;
	masterGain: number;
	emotion: boolean;
	textAppear: boolean;
	punctuation: boolean;
	transition: boolean;
}

export interface PipelineOptions {
	cover: CoverStyleOptions;
	caption: CaptionStyleOptions;
	tts: TtsOptions;
	logo: LogoPlacementOptions;
	segment: SegmentTransformOptions;
	sfx: SfxOptions;
	seed: number;
}

export interface ChannelProfile {
	id: string;
	name: string;
	logoDataUrl: string | null;
	options: PipelineOptions;
	createdAt: number;
	updatedAt: number;
}

export interface PipelineWarning {
	code:
		| "tts-fast"
		| "ocr-missing-cue"
		| "segment-cuts-cue"
		| "logo-overlap"
		| "low-confidence-ocr";
	message: string;
	cueIndex?: number;
	speedRatio?: number;
}

export type PipelineStage =
	| "loading-models"
	| "importing-video"
	| "parsing-srt"
	| "sampling-frames"
	| "ocr"
	| "matching"
	| "generating-tts"
	| "fitting-audio"
	| "classifying-emotions"
	| "picking-sfx"
	| "building-segments"
	| "building-elements"
	| "executing-command"
	| "done";

export interface PipelineProgress {
	stage: PipelineStage;
	current: number;
	total: number;
	message?: string;
}

export interface PipelineResult {
	captionTrackId: string | null;
	coverTrackId: string | null;
	audioTrackId: string | null;
	logoTrackId: string | null;
	sfxTrackId: string | null;
	warnings: PipelineWarning[];
}
