import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/wasm";
import type { CreateUploadAudioElement } from "@/timeline";
import type { FittedTts } from "./types";

export { pcmToWavBlob, pcmToWavFile } from "./wav";

/**
 * Build a CreateUploadAudioElement spec for a fitted TTS clip.
 * Caller (orchestrator) is responsible for registering the WAV File via
 * AddMediaAssetCommand to obtain `mediaId` before invoking this.
 */
export function buildAudioElement({
	mediaId,
	fittedTts,
	startSec,
	name,
	audioBuffer,
}: {
	mediaId: string;
	fittedTts: FittedTts;
	startSec: number;
	name: string;
	/** Pre-decoded buffer for waveform/preview rendering. Optional. */
	audioBuffer?: AudioBuffer;
}): CreateUploadAudioElement {
	return {
		type: "audio",
		sourceType: "upload",
		mediaId,
		name,
		duration: mediaTimeFromSeconds({ seconds: fittedTts.durationSec }),
		startTime: mediaTimeFromSeconds({ seconds: startSec }),
		trimStart: ZERO_MEDIA_TIME,
		trimEnd: ZERO_MEDIA_TIME,
		buffer: audioBuffer,
		params: {},
	};
}
