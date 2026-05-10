import { PitchShifter } from "soundtouchjs";
import { TTS_FAST_RATIO_THRESHOLD } from "./defaults";
import type { FittedTts, PipelineWarning, TtsResult } from "./types";

const RENDER_BUFFER_SIZE = 4096;

export interface FitOptions {
	/** Slot duration in seconds (the cue's allotted time). */
	slotSec: number;
	/** Above this speed-up ratio, emit a `tts-fast` warning. */
	fastThreshold?: number;
	/** Sample rate for the OfflineAudioContext output (defaults to TTS sampleRate). */
	outputSampleRate?: number;
}

export interface FitResult {
	fitted: FittedTts;
	warning: PipelineWarning | null;
}

/**
 * Compute the tempo ratio needed to fit `tts.durationSec` into `slotSec`.
 * Returns 1.0 if TTS already fits (we never slow audio down).
 */
export function computeSpeedRatio({
	ttsDurationSec,
	slotSec,
}: {
	ttsDurationSec: number;
	slotSec: number;
}): number {
	if (slotSec <= 0 || ttsDurationSec <= 0) return 1;
	if (ttsDurationSec <= slotSec) return 1;
	return ttsDurationSec / slotSec;
}

/** Pad mono PCM with trailing silence to reach `targetSamples` frames. */
export function padSilence({
	pcm,
	targetSamples,
}: {
	pcm: Float32Array;
	targetSamples: number;
}): Float32Array {
	if (pcm.length >= targetSamples) return pcm;
	const out = new Float32Array(targetSamples);
	out.set(pcm, 0);
	return out;
}

/** Trim PCM down to exactly `targetSamples` frames. */
export function trimToLength({
	pcm,
	targetSamples,
}: {
	pcm: Float32Array;
	targetSamples: number;
}): Float32Array {
	if (pcm.length <= targetSamples) return pcm;
	return pcm.subarray(0, targetSamples);
}

/**
 * Stretch/compress PCM via SoundTouch PitchShifter rendered offline.
 * tempo > 1 → faster (preserves pitch). Browser-only (uses OfflineAudioContext).
 */
export async function applyTempo({
	pcm,
	sampleRate,
	tempo,
	outputSampleRate,
}: {
	pcm: Float32Array;
	sampleRate: number;
	tempo: number;
	outputSampleRate?: number;
}): Promise<Float32Array> {
	if (tempo === 1) return pcm;

	const renderRate = outputSampleRate ?? sampleRate;
	const renderDurationSec = pcm.length / sampleRate / tempo;
	const renderFrames = Math.max(1, Math.ceil(renderDurationSec * renderRate));

	const offline = new OfflineAudioContext(2, renderFrames, renderRate);
	const inputBuffer = offline.createBuffer(2, pcm.length, sampleRate);
	// Copy into ArrayBuffer-backed Float32Array (copyToChannel rejects shared buffers).
	const channel = new Float32Array(pcm.length);
	channel.set(pcm);
	inputBuffer.copyToChannel(channel, 0);
	inputBuffer.copyToChannel(channel, 1);

	const shifter = new PitchShifter(offline, inputBuffer, RENDER_BUFFER_SIZE);
	shifter.tempo = tempo;
	shifter.connect(offline.destination);

	const rendered = await offline.startRendering();
	shifter.off();

	// Average L+R back to mono for storage.
	const left = rendered.getChannelData(0);
	const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
	const mono = new Float32Array(rendered.length);
	for (let i = 0; i < rendered.length; i++) {
		mono[i] = (left[i]! + right[i]!) / 2;
	}
	return mono;
}

/**
 * Fit a TTS clip into its cue slot:
 *   1. ratio ≤ 1 → pad with silence to slot length
 *   2. ratio > 1 → speed-up via SoundTouch, then trim to slot
 *
 * speedRatio is unbounded — caller is warned via `tts-fast` when above threshold.
 */
export async function fitTtsToSlot({
	tts,
	cueIndex,
	options,
}: {
	tts: TtsResult;
	cueIndex: number;
	options: FitOptions;
}): Promise<FitResult> {
	const { slotSec, fastThreshold = TTS_FAST_RATIO_THRESHOLD } = options;
	const targetSamples = Math.max(1, Math.round(slotSec * tts.sampleRate));
	const speedRatio = computeSpeedRatio({
		ttsDurationSec: tts.durationSec,
		slotSec,
	});

	let pcm: Float32Array;
	if (speedRatio === 1) {
		pcm = padSilence({ pcm: tts.pcm, targetSamples });
	} else {
		const stretched = await applyTempo({
			pcm: tts.pcm,
			sampleRate: tts.sampleRate,
			tempo: speedRatio,
			outputSampleRate: options.outputSampleRate,
		});
		pcm = padSilence({
			pcm: trimToLength({ pcm: stretched, targetSamples }),
			targetSamples,
		});
	}

	const fitted: FittedTts = {
		pcm,
		sampleRate: tts.sampleRate,
		durationSec: pcm.length / tts.sampleRate,
		speedRatio,
	};

	const warning: PipelineWarning | null =
		speedRatio > fastThreshold
			? {
					code: "tts-fast",
					message: `Cue ${cueIndex + 1} TTS is ${speedRatio.toFixed(2)}× faster than original to fit slot.`,
					cueIndex,
					speedRatio,
			  }
			: null;

	return { fitted, warning };
}

export async function fitAll({
	ttsResults,
	cues,
	fastThreshold,
	outputSampleRate,
	signal,
}: {
	ttsResults: TtsResult[];
	cues: { duration: number }[];
	fastThreshold?: number;
	outputSampleRate?: number;
	signal?: AbortSignal;
}): Promise<{ fitted: FittedTts[]; warnings: PipelineWarning[] }> {
	const fitted: FittedTts[] = [];
	const warnings: PipelineWarning[] = [];
	for (let i = 0; i < ttsResults.length; i++) {
		if (signal?.aborted) throw new Error("aborted");
		const result = await fitTtsToSlot({
			tts: ttsResults[i]!,
			cueIndex: i,
			options: {
				slotSec: cues[i]!.duration,
				fastThreshold,
				outputSampleRate,
			},
		});
		fitted.push(result.fitted);
		if (result.warning) warnings.push(result.warning);
	}
	return { fitted, warnings };
}
