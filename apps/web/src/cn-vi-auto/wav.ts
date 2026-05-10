/**
 * Encode mono Float32 PCM as a 16-bit PCM WAV blob.
 * Pure function — no DOM/AudioContext/OpenCut dependencies.
 */
export function pcmToWavBlob({
	pcm,
	sampleRate,
}: {
	pcm: Float32Array;
	sampleRate: number;
}): Blob {
	const numChannels = 1;
	const bitsPerSample = 16;
	const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
	const blockAlign = (numChannels * bitsPerSample) / 8;
	const dataSize = pcm.length * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	let offset = 0;
	function writeString(s: string) {
		for (let i = 0; i < s.length; i++) {
			view.setUint8(offset++, s.charCodeAt(i));
		}
	}
	function writeUint32LE(value: number) {
		view.setUint32(offset, value, true);
		offset += 4;
	}
	function writeUint16LE(value: number) {
		view.setUint16(offset, value, true);
		offset += 2;
	}

	writeString("RIFF");
	writeUint32LE(36 + dataSize);
	writeString("WAVE");
	writeString("fmt ");
	writeUint32LE(16);
	writeUint16LE(1);
	writeUint16LE(numChannels);
	writeUint32LE(sampleRate);
	writeUint32LE(byteRate);
	writeUint16LE(blockAlign);
	writeUint16LE(bitsPerSample);
	writeString("data");
	writeUint32LE(dataSize);

	for (let i = 0; i < pcm.length; i++) {
		const sample = Math.max(-1, Math.min(1, pcm[i]!));
		view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
		offset += 2;
	}

	return new Blob([buffer], { type: "audio/wav" });
}

export function pcmToWavFile({
	pcm,
	sampleRate,
	name,
}: {
	pcm: Float32Array;
	sampleRate: number;
	name: string;
}): File {
	const blob = pcmToWavBlob({ pcm, sampleRate });
	return new File([blob], name, { type: "audio/wav" });
}
