import { mediaTimeFromSeconds, ZERO_MEDIA_TIME } from "@/wasm";
import type { CreateUploadAudioElement } from "@/timeline";
import type { SfxAsset, SfxPick } from "../types";

/**
 * Fetch an SFX asset's MP3 file. Returns null when the file 404s — the
 * orchestrator skip-and-warns rather than failing the pipeline.
 */
export async function loadSfxBlob({
	asset,
	signal,
}: {
	asset: SfxAsset;
	signal?: AbortSignal;
}): Promise<Blob | null> {
	try {
		const response = await fetch(asset.file, { signal });
		if (!response.ok) return null;
		return await response.blob();
	} catch {
		return null;
	}
}

export async function loadSfxFile({
	asset,
	signal,
}: {
	asset: SfxAsset;
	signal?: AbortSignal;
}): Promise<File | null> {
	const blob = await loadSfxBlob({ asset, signal });
	if (!blob) return null;
	const filename = asset.file.split("/").pop() ?? `${asset.id}.mp3`;
	return new File([blob], filename, { type: blob.type || "audio/mpeg" });
}

/**
 * Convert a SfxPick (asset + start time + gain) into a CreateUploadAudioElement.
 * Caller obtains `mediaId` by registering the SFX File via AddMediaAssetCommand.
 */
export function buildSfxElement({
	mediaId,
	pick,
	audioBuffer,
}: {
	mediaId: string;
	pick: SfxPick;
	audioBuffer?: AudioBuffer;
}): CreateUploadAudioElement {
	return {
		type: "audio",
		sourceType: "upload",
		mediaId,
		name: `SFX: ${pick.asset.id}`,
		duration: mediaTimeFromSeconds({ seconds: pick.asset.durationSec }),
		startTime: mediaTimeFromSeconds({ seconds: Math.max(0, pick.startSec) }),
		trimStart: ZERO_MEDIA_TIME,
		trimEnd: ZERO_MEDIA_TIME,
		buffer: audioBuffer,
		params: {
			volume: gainToDb({ gain: pick.gain }),
		},
	};
}

/** Convert a 0..1 linear gain to dBFS (clipped to a reasonable floor). */
function gainToDb({ gain }: { gain: number }): number {
	if (gain <= 0) return -60;
	return Math.max(-60, 20 * Math.log10(gain));
}
