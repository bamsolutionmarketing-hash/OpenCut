import { describe, expect, test } from "bun:test";
import { pcmToWavBlob } from "../wav";

async function readBlob(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer());
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
	let s = "";
	for (let i = 0; i < length; i++) {
		s += String.fromCharCode(bytes[offset + i]!);
	}
	return s;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
	return (
		bytes[offset]! |
		(bytes[offset + 1]! << 8) |
		(bytes[offset + 2]! << 16) |
		(bytes[offset + 3]! << 24)
	);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
	return bytes[offset]! | (bytes[offset + 1]! << 8);
}

describe("pcmToWavBlob", () => {
	test("writes a valid 16-bit PCM WAV header", async () => {
		const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
		const blob = pcmToWavBlob({ pcm, sampleRate: 16000 });
		const bytes = await readBlob(blob);

		expect(readAscii(bytes, 0, 4)).toBe("RIFF");
		expect(readAscii(bytes, 8, 4)).toBe("WAVE");
		expect(readAscii(bytes, 12, 4)).toBe("fmt ");
		expect(readUint32LE(bytes, 16)).toBe(16); // fmt chunk size
		expect(readUint16LE(bytes, 20)).toBe(1); // PCM
		expect(readUint16LE(bytes, 22)).toBe(1); // mono
		expect(readUint32LE(bytes, 24)).toBe(16000);
		expect(readUint16LE(bytes, 32)).toBe(2); // block align
		expect(readUint16LE(bytes, 34)).toBe(16); // bits per sample
		expect(readAscii(bytes, 36, 4)).toBe("data");
		expect(readUint32LE(bytes, 40)).toBe(pcm.length * 2);
		expect(bytes.length).toBe(44 + pcm.length * 2);
	});

	test("clamps samples outside [-1, 1]", async () => {
		const pcm = new Float32Array([2, -2]);
		const blob = pcmToWavBlob({ pcm, sampleRate: 8000 });
		const bytes = await readBlob(blob);
		const view = new DataView(bytes.buffer);
		expect(view.getInt16(44, true)).toBe(0x7fff);
		expect(view.getInt16(46, true)).toBe(-0x8000);
	});
});
