import type { PipelineOptions } from "./types";

export const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = {
	cover: {
		color: "#000000",
		opacity: 1,
		paddingRatio: 0.12,
	},
	caption: {
		fontFamily: "Be Vietnam Pro",
		color: "#ffffff",
		strokeColor: "#000000",
		strokeWidth: 3,
	},
	tts: {
		enabled: true,
		muteOriginal: true,
	},
	logo: {
		enabled: false,
		intervalSec: 5,
		sizeRatio: 0.12,
		opacity: 0.7,
		avoidCaption: true,
		paddingRatio: 0.05,
	},
	segment: {
		durationSec: 15,
		scale: { enabled: true, min: 1.02, max: 1.08 },
		zoom: {
			enabled: true,
			modes: ["static", "slow-in", "slow-out"],
		},
		flip: { enabled: false, probability: 0.3 },
		rotate: { enabled: false, minDeg: -2, maxDeg: 2 },
		cropX: { enabled: true, range: 0.02 },
		cropY: { enabled: false, range: 0.02 },
		speed: { enabled: false, min: 0.98, max: 1.03 },
	},
	sfx: {
		enabled: true,
		level: "medium",
		masterGain: 0.6,
		emotion: true,
		textAppear: true,
		punctuation: true,
		transition: true,
	},
	seed: 0,
};

export const FRAME_SAMPLING_FPS = 6;
export const SUBTITLE_ROI_TOP_RATIO = 0.65;
export const SUBTITLE_ROI_HEIGHT_RATIO = 0.35;

export const TTS_FAST_RATIO_THRESHOLD = 1.6;
export const TTS_MAX_PARALLEL = 2;

export const OCR_MIN_CONFIDENCE = 50;
export const OCR_LANGUAGES = "chi_sim+chi_tra";

export const DEFAULT_ZONE = {
	xRatio: 0.1,
	yRatio: 0.78,
	widthRatio: 0.8,
	heightRatio: 0.1,
} as const;
