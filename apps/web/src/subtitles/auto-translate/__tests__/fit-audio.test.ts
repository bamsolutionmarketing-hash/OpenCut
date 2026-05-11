import { describe, expect, test } from "bun:test";
import {
	computeSpeedRatio,
	padSilence,
	trimToLength,
} from "../fit-audio";

describe("computeSpeedRatio", () => {
	test("returns 1 when TTS already fits in slot", () => {
		expect(
			computeSpeedRatio({ ttsDurationSec: 1.5, slotSec: 2 }),
		).toBe(1);
	});

	test("returns ratio > 1 when TTS overflows slot", () => {
		expect(
			computeSpeedRatio({ ttsDurationSec: 3, slotSec: 2 }),
		).toBe(1.5);
	});

	test("returns 1 for non-positive slot or duration", () => {
		expect(computeSpeedRatio({ ttsDurationSec: 1, slotSec: 0 })).toBe(1);
		expect(computeSpeedRatio({ ttsDurationSec: 0, slotSec: 1 })).toBe(1);
		expect(computeSpeedRatio({ ttsDurationSec: -1, slotSec: 1 })).toBe(1);
	});

	test("does not cap the ratio", () => {
		expect(
			computeSpeedRatio({ ttsDurationSec: 10, slotSec: 1 }),
		).toBe(10);
	});
});

describe("padSilence", () => {
	test("appends zeros up to targetSamples", () => {
		const out = padSilence({
			pcm: new Float32Array([0.5, -0.5]),
			targetSamples: 5,
		});
		expect(out.length).toBe(5);
		expect(Array.from(out)).toEqual([0.5, -0.5, 0, 0, 0]);
	});

	test("returns input unchanged when already at or above target", () => {
		const input = new Float32Array([0.1, 0.2, 0.3]);
		expect(padSilence({ pcm: input, targetSamples: 3 })).toBe(input);
		expect(padSilence({ pcm: input, targetSamples: 2 })).toBe(input);
	});
});

describe("trimToLength", () => {
	test("returns subarray when longer than target", () => {
		const input = new Float32Array([1, 2, 3, 4, 5]);
		const out = trimToLength({ pcm: input, targetSamples: 3 });
		expect(out.length).toBe(3);
		expect(Array.from(out)).toEqual([1, 2, 3]);
	});

	test("returns input unchanged when at or below target", () => {
		const input = new Float32Array([1, 2]);
		expect(trimToLength({ pcm: input, targetSamples: 5 })).toBe(input);
	});
});
